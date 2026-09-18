import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import {
  EstadoRegistro,
  ListaPrecio,
  Moneda,
  Organizacion,
} from '@cotizador/database';
import {
  type OrgContext,
  PERMISOS,
  editarConfiguracionOrganizacionSchema,
  monedaInactiva,
  organizacionCambioMonedaBaseNoConfirmado,
  organizacionIdentificacionDuplicada,
  organizacionMonedaPresentacionIgualABase,
  organizacionNoEncontrada,
  organizacionNombreDuplicado,
  organizacionUmbralesIncoherentes,
  requireOrganizacionContext,
  requirePermission,
} from '@cotizador/shared';
import { mapOrganizacionConfiguracion } from './configuracion.mapper';

@Injectable()
export class ConfiguracionOrganizacionService {
  constructor(
    @InjectRepository(Organizacion)
    private readonly organizacionRepo: Repository<Organizacion>,
    @InjectRepository(Moneda)
    private readonly monedaRepo: Repository<Moneda>,
    @InjectRepository(ListaPrecio)
    private readonly listaPrecioRepo: Repository<ListaPrecio>,
  ) {}

  async obtener(ctx: OrgContext) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.CONFIGURACION_ORGANIZACION_VER);
    const org = await this.cargarOrganizacion(ctx.organizacionId);
    return mapOrganizacionConfiguracion(org);
  }

  async editar(ctx: OrgContext, body: unknown) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.CONFIGURACION_ORGANIZACION_ADMINISTRAR);

    const input = editarConfiguracionOrganizacionSchema.parse(body);
    const org = await this.cargarOrganizacion(ctx.organizacionId);

    if (input.nombre !== undefined && input.nombre !== org.nombre) {
      const dup = await this.organizacionRepo.findOne({
        where: { nombre: input.nombre },
      });
      if (dup && dup.id !== org.id) {
        throw organizacionNombreDuplicado();
      }
      org.nombre = input.nombre;
    }

    if (input.identificacionFiscal !== undefined) {
      const valor = input.identificacionFiscal;
      if (valor) {
        const dup = await this.organizacionRepo.findOne({
          where: { identificacionFiscal: valor },
        });
        if (dup && dup.id !== org.id) {
          throw organizacionIdentificacionDuplicada();
        }
      }
      org.identificacionFiscal = valor;
    }

    if (input.razonSocial !== undefined) org.razonSocial = input.razonSocial;
    if (input.telefono !== undefined) org.telefono = input.telefono;
    if (input.email !== undefined) org.email = input.email;
    if (input.direccion !== undefined) org.direccion = input.direccion;
    if (input.zonaHoraria !== undefined) org.zonaHoraria = input.zonaHoraria;
    if (input.locale !== undefined) org.locale = input.locale;
    if (input.usaIa !== undefined) org.usaIa = input.usaIa;

    const monedaBaseAnterior = org.monedaBaseId;
    const monedaBaseId = input.monedaBaseId ?? org.monedaBaseId;
    const monedaPresentacionId =
      input.monedaPresentacionId !== undefined
        ? input.monedaPresentacionId
        : org.monedaPresentacionId;

    if (input.monedaBaseId && input.monedaBaseId !== org.monedaBaseId) {
      if (!input.confirmarCambioMonedaBase) {
        throw organizacionCambioMonedaBaseNoConfirmado();
      }
      await this.asegurarMonedaActiva(input.monedaBaseId);
      org.monedaBaseId = input.monedaBaseId;
    }

    if (input.monedaPresentacionId !== undefined) {
      if (input.monedaPresentacionId) {
        await this.asegurarMonedaActiva(input.monedaPresentacionId);
      }
      org.monedaPresentacionId = input.monedaPresentacionId;
    }

    if (monedaPresentacionId && monedaPresentacionId === monedaBaseId) {
      throw organizacionMonedaPresentacionIgualABase();
    }

    const umbralAuto = input.umbralAutomatico ?? String(org.umbralAutomatico);
    const umbralDesc = input.umbralDescarte ?? String(org.umbralDescarte);
    if (!(Number(umbralDesc) < Number(umbralAuto))) {
      throw organizacionUmbralesIncoherentes();
    }
    if (input.umbralAutomatico !== undefined) {
      org.umbralAutomatico = input.umbralAutomatico;
    }
    if (input.umbralDescarte !== undefined) {
      org.umbralDescarte = input.umbralDescarte;
    }

    org.updatedById = ctx.usuarioId;
    await this.organizacionRepo.save(org);

    const advertencias: Array<{
      codigo: 'LISTAS_EN_OTRA_MONEDA' | 'TASA_CAMBIO_AUSENTE';
      mensaje: string;
      detalle?: unknown;
    }> = [];

    if (input.monedaBaseId && input.monedaBaseId !== monedaBaseAnterior) {
      const listasOtraMoneda = await this.listaPrecioRepo.find({
        where: {
          organizacionId: org.id,
          monedaId: Not(org.monedaBaseId),
          estadoRegistro: EstadoRegistro.ACTIVO,
        },
      });
      if (listasOtraMoneda.length > 0) {
        advertencias.push({
          codigo: 'LISTAS_EN_OTRA_MONEDA',
          mensaje:
            'Hay listas de precios cuya moneda no coincide con la moneda base nueva.',
          detalle: listasOtraMoneda.map((l) => ({ id: l.id, nombre: l.nombre })),
        });
      }
    }

    const actualizada = await this.cargarOrganizacion(org.id);
    return {
      organizacion: mapOrganizacionConfiguracion(actualizada),
      advertencias,
    };
  }

  async actualizarLogoUrl(ctx: OrgContext, logoUrl: string | null) {
    requireOrganizacionContext(ctx);
    requirePermission(ctx, PERMISOS.CONFIGURACION_ORGANIZACION_ADMINISTRAR);
    const org = await this.organizacionRepo.findOne({
      where: { id: ctx.organizacionId },
    });
    if (!org) throw organizacionNoEncontrada();
    org.logoUrl = logoUrl;
    org.updatedById = ctx.usuarioId;
    await this.organizacionRepo.save(org);
    return this.obtener(ctx);
  }

  private async cargarOrganizacion(id: string): Promise<Organizacion> {
    const org = await this.organizacionRepo.findOne({
      where: { id },
      relations: { monedaBase: true, monedaPresentacion: true },
    });
    if (!org) throw organizacionNoEncontrada();
    return org;
  }

  private async asegurarMonedaActiva(id: string): Promise<void> {
    const moneda = await this.monedaRepo.findOne({ where: { id } });
    if (!moneda || moneda.estadoRegistro !== EstadoRegistro.ACTIVO) {
      throw monedaInactiva();
    }
  }
}
