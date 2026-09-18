import 'reflect-metadata';
import bcrypt from 'bcryptjs';
import { PERMISOS, PERMISOS_DESCRIPCION } from '@cotizador/shared';
import type { PermisoCodigo } from '@cotizador/shared';
import { AppDataSource } from '../data-source';
import {
  Moneda,
  Perfil,
  PerfilPermiso,
  Permiso,
  Usuario,
  UsuarioPerfil,
  Vertical,
} from '../entities';
import { AmbitoPerfil, EstadoRegistro } from '../enums';

const TODOS_LOS_PERMISOS = Object.values(PERMISOS) as PermisoCodigo[];

function moduloDeCodigo(codigo: string): string {
  return codigo.split('.')[0] ?? codigo;
}

function coincidePrefijo(codigo: string, patron: string): boolean {
  if (patron.endsWith('.*')) {
    return codigo.startsWith(patron.slice(0, -1));
  }
  return codigo === patron;
}

const PERFIL_SUPERADMIN_PATRONES = ['plataforma.*'];

const PERFIL_ADMIN_ORG_PATRONES = [
  'configuracion.*',
  'seguridad.*',
  'catalogo.*',
  'precios.*',
  'clientes.*',
  'cotizaciones.*',
  'plantillas.*',
  'reportes.ver',
];

const PERFIL_COTIZADOR_CODIGOS: PermisoCodigo[] = [
  PERMISOS.CATALOGO_ITEMS_VER,
  PERMISOS.CATALOGO_MAESTRAS_VER,
  PERMISOS.CATALOGO_ALIAS_ADMINISTRAR,
  PERMISOS.PRECIOS_LISTAS_VER,
  PERMISOS.CLIENTES_VER,
  PERMISOS.CLIENTES_CREAR,
  PERMISOS.CLIENTES_EDITAR,
  PERMISOS.COTIZACIONES_VER,
  PERMISOS.COTIZACIONES_CREAR,
  PERMISOS.COTIZACIONES_EDITAR,
  PERMISOS.COTIZACIONES_APROBAR,
  PERMISOS.COTIZACIONES_GENERAR_DOCUMENTO,
  PERMISOS.COTIZACIONES_REGISTRAR_RESULTADO,
  PERMISOS.REPORTES_VER,
];

const MONEDAS_SEED = [
  { codigoIso: 'USD', nombre: 'Dólar estadounidense', simbolo: '$', decimales: 2 },
  { codigoIso: 'VES', nombre: 'Bolívar soberano', simbolo: 'Bs.', decimales: 2 },
  { codigoIso: 'COP', nombre: 'Peso colombiano', simbolo: '$', decimales: 0 },
  { codigoIso: 'EUR', nombre: 'Euro', simbolo: '€', decimales: 2 },
];

const VERTICALES_SEED = [
  {
    codigo: 'FERRETERIA',
    nombre: 'Ferretería',
    descripcion: 'Materiales de construcción, herramientas y ferretería general',
  },
  {
    codigo: 'REPUESTOS',
    nombre: 'Repuestos',
    descripcion: 'Repuestos y refacciones industriales o de maquinaria',
  },
  {
    codigo: 'AUTOMOTRIZ',
    nombre: 'Automotriz',
    descripcion: 'Repuestos y accesorios para vehículos',
  },
  {
    codigo: 'GENERICO',
    nombre: 'Genérico',
    descripcion: 'Catálogo genérico sin pack de vertical específico',
  },
];

async function asegurarPermisos(permisoRepo: ReturnType<typeof AppDataSource.getRepository<Permiso>>) {
  for (const codigo of TODOS_LOS_PERMISOS) {
    const existente = await permisoRepo.findOne({ where: { codigo } });
    if (!existente) {
      await permisoRepo.save(
        permisoRepo.create({
          codigo,
          modulo: moduloDeCodigo(codigo),
          descripcion: PERMISOS_DESCRIPCION[codigo],
        }),
      );
    }
  }
}

async function asegurarPerfilConPermisos(params: {
  perfilRepo: ReturnType<typeof AppDataSource.getRepository<Perfil>>;
  perfilPermisoRepo: ReturnType<typeof AppDataSource.getRepository<PerfilPermiso>>;
  permisos: Permiso[];
  nombre: string;
  codigo: string;
  ambito: AmbitoPerfil;
  descripcion: string;
  codigosPermitidos: string[];
}) {
  const {
    perfilRepo,
    perfilPermisoRepo,
    permisos,
    nombre,
    codigo,
    ambito,
    descripcion,
    codigosPermitidos,
  } = params;

  let perfil = await perfilRepo.findOne({ where: { codigo } });
  if (!perfil) {
    perfil = await perfilRepo.save(
      perfilRepo.create({
        nombre,
        codigo,
        ambito,
        descripcion,
        esSistema: true,
        estadoRegistro: EstadoRegistro.ACTIVO,
      }),
    );
  }

  const permitidos = new Set(codigosPermitidos);
  for (const permiso of permisos) {
    if (!permitidos.has(permiso.codigo)) continue;
    const existe = await perfilPermisoRepo.findOne({
      where: { perfilId: perfil.id, permisoId: permiso.id },
    });
    if (!existe) {
      await perfilPermisoRepo.save(
        perfilPermisoRepo.create({
          perfilId: perfil.id,
          permisoId: permiso.id,
        }),
      );
    }
  }

  return perfil;
}

function expandirPatrones(patrones: string[]): string[] {
  return TODOS_LOS_PERMISOS.filter((codigo) =>
    patrones.some((patron) => coincidePrefijo(codigo, patron)),
  );
}

async function runSeed() {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  const permisoRepo = AppDataSource.getRepository(Permiso);
  const perfilRepo = AppDataSource.getRepository(Perfil);
  const perfilPermisoRepo = AppDataSource.getRepository(PerfilPermiso);
  const monedaRepo = AppDataSource.getRepository(Moneda);
  const verticalRepo = AppDataSource.getRepository(Vertical);
  const usuarioRepo = AppDataSource.getRepository(Usuario);
  const usuarioPerfilRepo = AppDataSource.getRepository(UsuarioPerfil);

  await asegurarPermisos(permisoRepo);
  const permisos = await permisoRepo.find();

  const perfilSuperadmin = await asegurarPerfilConPermisos({
    perfilRepo,
    perfilPermisoRepo,
    permisos,
    nombre: 'Superadmin Plataforma',
    codigo: 'SUPERADMIN_PLATAFORMA',
    ambito: AmbitoPerfil.PLATAFORMA,
    descripcion: 'Administracion de la plataforma y organizaciones',
    codigosPermitidos: expandirPatrones(PERFIL_SUPERADMIN_PATRONES),
  });

  await asegurarPerfilConPermisos({
    perfilRepo,
    perfilPermisoRepo,
    permisos,
    nombre: 'Administrador Organizacion',
    codigo: 'ADMINISTRADOR_ORGANIZACION',
    ambito: AmbitoPerfil.ORGANIZACION,
    descripcion: 'Administracion completa dentro de una organizacion',
    codigosPermitidos: expandirPatrones(PERFIL_ADMIN_ORG_PATRONES),
  });

  await asegurarPerfilConPermisos({
    perfilRepo,
    perfilPermisoRepo,
    permisos,
    nombre: 'Cotizador',
    codigo: 'COTIZADOR',
    ambito: AmbitoPerfil.ORGANIZACION,
    descripcion: 'Operacion de cotizaciones sin administrar precios ni usuarios',
    codigosPermitidos: PERFIL_COTIZADOR_CODIGOS,
  });

  for (const moneda of MONEDAS_SEED) {
    const existe = await monedaRepo.findOne({ where: { codigoIso: moneda.codigoIso } });
    if (!existe) {
      await monedaRepo.save(
        monedaRepo.create({
          ...moneda,
          estadoRegistro: EstadoRegistro.ACTIVO,
        }),
      );
    }
  }

  for (const vertical of VERTICALES_SEED) {
    const existe = await verticalRepo.findOne({ where: { codigo: vertical.codigo } });
    if (!existe) {
      await verticalRepo.save(
        verticalRepo.create({
          ...vertical,
          estadoRegistro: EstadoRegistro.ACTIVO,
        }),
      );
    }
  }

  const email = process.env.SEED_ADMIN_EMAIL?.trim();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error(
      'SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD son obligatorias para crear el superadmin.',
    );
  }

  let admin = await usuarioRepo.findOne({ where: { email } });
  if (!admin) {
    const passwordHash = await bcrypt.hash(password, 12);
    admin = await usuarioRepo.save(
      usuarioRepo.create({
        organizacionId: null,
        nombreCompleto: 'Superadmin Plataforma',
        email,
        passwordHash,
        debeCambiarPassword: true,
        estadoRegistro: EstadoRegistro.ACTIVO,
      }),
    );
    console.log(`Usuario superadmin creado: ${email}`);
  } else {
    console.log(`Usuario superadmin ya existe: ${email}`);
  }

  const vinculo = await usuarioPerfilRepo.findOne({
    where: { usuarioId: admin.id, perfilId: perfilSuperadmin.id },
  });
  if (!vinculo) {
    await usuarioPerfilRepo.save(
      usuarioPerfilRepo.create({
        usuarioId: admin.id,
        perfilId: perfilSuperadmin.id,
      }),
    );
  }

  console.log(
    'Seed de plataforma completado (permisos, perfiles, monedas, verticales, superadmin).',
  );

  await AppDataSource.destroy();
}

runSeed().catch((error) => {
  console.error('Error ejecutando seed', error);
  process.exit(1);
});
