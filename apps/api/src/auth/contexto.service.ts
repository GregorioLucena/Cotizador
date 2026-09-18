import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  AmbitoPerfil,
  EstadoRegistro,
  Perfil,
  Sucursal,
  Usuario,
  UsuarioPerfil,
  UsuarioSucursal,
} from '@cotizador/database';
import type { OrgContext } from '@cotizador/shared';
import { UnauthorizedError } from '@cotizador/shared';

@Injectable()
export class ContextoService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,
    @InjectRepository(UsuarioPerfil)
    private readonly usuarioPerfilRepo: Repository<UsuarioPerfil>,
    @InjectRepository(UsuarioSucursal)
    private readonly usuarioSucursalRepo: Repository<UsuarioSucursal>,
    @InjectRepository(Perfil)
    private readonly perfilRepo: Repository<Perfil>,
    @InjectRepository(Sucursal)
    private readonly sucursalRepo: Repository<Sucursal>,
  ) {}

  async construir(
    usuarioId: string,
    sesionId: string,
    sucursalPreferidaId?: string,
  ): Promise<OrgContext> {
    const usuario = await this.usuarioRepo.findOne({ where: { id: usuarioId } });
    if (!usuario) {
      throw new UnauthorizedError();
    }

    const asignaciones = await this.usuarioPerfilRepo.find({
      where: { usuarioId },
    });
    const perfilIds = asignaciones.map((a) => a.perfilId);

    let permisos: string[] = [];
    if (perfilIds.length > 0) {
      const perfiles = await this.perfilRepo.find({
        where: { id: In(perfilIds) },
        relations: { permisos: { permiso: true } },
      });
      const set = new Set<string>();
      for (const perfil of perfiles) {
        for (const pp of perfil.permisos ?? []) {
          if (pp.permiso?.codigo) {
            set.add(pp.permiso.codigo);
          }
        }
      }
      permisos = [...set];
    }

    const esPlataforma = usuario.organizacionId == null;
    const ambito = esPlataforma ? AmbitoPerfil.PLATAFORMA : AmbitoPerfil.ORGANIZACION;

    if (esPlataforma) {
      return {
        usuarioId: usuario.id,
        organizacionId: null,
        ambito,
        sucursalIds: [],
        permisos,
        sesionId,
      };
    }

    const asignacionesSucursal = await this.usuarioSucursalRepo.find({
      where: { usuarioId },
    });
    const sucursalIdsAsignadas = asignacionesSucursal.map((a) => a.sucursalId);

    let sucursales: Sucursal[] = [];
    if (sucursalIdsAsignadas.length > 0) {
      sucursales = await this.sucursalRepo.find({
        where: {
          id: In(sucursalIdsAsignadas),
          organizacionId: usuario.organizacionId!,
          estadoRegistro: EstadoRegistro.ACTIVO,
        },
        order: { nombre: 'ASC' },
      });
    }

    const sucursalIds = sucursales.map((s) => s.id);
    const sucursalActivaId = this.elegirSucursalActiva(sucursales, sucursalPreferidaId);

    return {
      usuarioId: usuario.id,
      organizacionId: usuario.organizacionId!,
      ambito,
      sucursalIds,
      ...(sucursalActivaId ? { sucursalActivaId } : {}),
      permisos,
      sesionId,
    };
  }

  private elegirSucursalActiva(
    sucursales: Sucursal[],
    preferidaId?: string,
  ): string | undefined {
    if (sucursales.length === 0) {
      return undefined;
    }
    if (preferidaId) {
      const preferida = sucursales.find((s) => s.id === preferidaId);
      if (preferida) {
        return preferida.id;
      }
    }
    const principal = sucursales.find((s) => s.esPrincipal);
    if (principal) {
      return principal.id;
    }
    return sucursales[0]?.id;
  }
}
