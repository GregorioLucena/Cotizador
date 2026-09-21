/**
 * Datos de demostración para la organización "Demo Ferretería".
 * Idempotente: se puede repetir `pnpm db:seed` sin duplicar.
 *
 * Desactivar con SEED_DEMO=false.
 */
import bcrypt from 'bcryptjs';
import { normalizarTexto, normalizarTextoBusqueda } from '@cotizador/shared';
import type { DataSource, Repository } from 'typeorm';
import {
  Categoria,
  Cliente,
  ConfiguracionCotizacion,
  DefinicionAtributo,
  Item,
  ItemAlias,
  ListaPrecio,
  Marca,
  Moneda,
  Organizacion,
  PlantillaDocumento,
  PrecioItem,
  Sucursal,
  TasaCambio,
  UnidadMedida,
  Usuario,
  UsuarioPerfil,
  UsuarioSucursal,
} from '../entities';
import {
  EstadoRegistro,
  FuenteTasaCambio,
  ModoRedondeo,
  OrigenAlias,
  TipoDatoAtributo,
  TipoItem,
} from '../enums';
import { getPack, type PackVertical } from './verticales';

const ORG_DEMO_NOMBRE = 'Demo Ferretería';

type DemoItemDef = {
  sku: string;
  nombre: string;
  unidadCodigo: string;
  categoriaNombre: string;
  marcaNombre?: string;
  precio: string;
  aliases?: string[];
  atributos?: Record<string, unknown>;
};

const ITEMS_DEMO: DemoItemDef[] = [
  {
    sku: 'PVC-TUB-050-3M',
    nombre: 'Tubo PVC 1/2" × 3m',
    unidadCodigo: 'UND',
    categoriaNombre: 'Tuberia',
    marcaNombre: 'Genérico',
    precio: '11.2500',
    aliases: ['tubo de media', 'tubos de 1/2', 'tubo pvc media'],
    atributos: { diametro: '1/2"', material: 'PVC', medida: '3m' },
  },
  {
    sku: 'PVC-COD-050',
    nombre: 'Codo PVC 1/2"',
    unidadCodigo: 'UND',
    categoriaNombre: 'Conexiones',
    marcaNombre: 'Genérico',
    precio: '0.8500',
    aliases: ['codo', 'codos', 'codo de media'],
    atributos: { diametro: '1/2"', material: 'PVC' },
  },
  {
    sku: 'PVC-PEG-AZUL',
    nombre: 'Pegamento PVC azul',
    unidadCodigo: 'UND',
    categoriaNombre: 'Pegamentos',
    marcaNombre: 'Genérico',
    precio: '8.7500',
    aliases: ['pega azul', 'pegamento azul', 'pegamento pvc'],
    atributos: { material: 'PVC', color: 'azul' },
  },
  {
    sku: 'TEF-1/2',
    nombre: 'Cinta teflón 1/2"',
    unidadCodigo: 'UND',
    categoriaNombre: 'Conexiones',
    precio: '1.2000',
    aliases: ['teflon', 'cinta de plomero'],
  },
  {
    sku: 'CAB-12AWG',
    nombre: 'Cable THW 12 AWG',
    unidadCodigo: 'M',
    categoriaNombre: 'Cables',
    precio: '0.9500',
    aliases: ['cable numero 12', 'cable 12'],
  },
  {
    sku: 'RAM-CHAZA',
    nombre: 'Ramplug plástico',
    unidadCodigo: 'UND',
    categoriaNombre: 'Anclajes y ramplugs',
    precio: '0.1500',
    aliases: ['chaza', 'ramplug'],
  },
];

function mapTipoDato(tipo: string): TipoDatoAtributo {
  if (tipo in TipoDatoAtributo) {
    return TipoDatoAtributo[tipo as keyof typeof TipoDatoAtributo];
  }
  return TipoDatoAtributo.TEXTO;
}

function mapModoRedondeo(modo: string): ModoRedondeo {
  if (modo === 'ARRIBA') return ModoRedondeo.ARRIBA;
  if (modo === 'ABAJO') return ModoRedondeo.ABAJO;
  return ModoRedondeo.NORMAL;
}

function demoHabilitado(): boolean {
  const v = process.env.SEED_DEMO?.trim().toLowerCase();
  if (v === 'false' || v === '0' || v === 'no') return false;
  return true;
}

async function asegurarPackDemo(
  ds: DataSource,
  org: Organizacion,
  pack: PackVertical,
  createdById: string | null,
) {
  const unidadRepo = ds.getRepository(UnidadMedida);
  const yaTieneUnidades = await unidadRepo.count({
    where: { organizacionId: org.id },
  });
  if (yaTieneUnidades > 0) return;

  const audit = {
    createdById: createdById ?? undefined,
    updatedById: createdById ?? undefined,
  };

  await unidadRepo.save(
    pack.unidadesMedida.map((u) =>
      unidadRepo.create({
        organizacionId: org.id,
        codigo: u.codigo,
        nombre: u.nombre,
        permiteDecimales: u.permiteDecimales,
        estadoRegistro: EstadoRegistro.ACTIVO,
        ...audit,
      }),
    ),
  );

  const defRepo = ds.getRepository(DefinicionAtributo);
  await defRepo.save(
    pack.definicionesAtributo.map((d) =>
      defRepo.create({
        organizacionId: org.id,
        codigo: d.codigo,
        etiqueta: d.etiqueta,
        tipoDato: mapTipoDato(d.tipoDato),
        opciones: d.opciones ?? null,
        unidadSugerida: d.unidadSugerida ?? null,
        requerido: d.requerido,
        usarEnBusqueda: d.usarEnBusqueda,
        orden: d.orden,
        estadoRegistro: EstadoRegistro.ACTIVO,
        ...audit,
      }),
    ),
  );

  const catRepo = ds.getRepository(Categoria);
  for (const cat of pack.categorias) {
    const padre = await catRepo.save(
      catRepo.create({
        organizacionId: org.id,
        nombre: cat.nombre,
        categoriaPadreId: null,
        orden: cat.orden,
        estadoRegistro: EstadoRegistro.ACTIVO,
        ...audit,
      }),
    );
    for (const sub of cat.subcategorias ?? []) {
      await catRepo.save(
        catRepo.create({
          organizacionId: org.id,
          nombre: sub.nombre,
          categoriaPadreId: padre.id,
          orden: sub.orden,
          estadoRegistro: EstadoRegistro.ACTIVO,
          ...audit,
        }),
      );
    }
  }

  const listaRepo = ds.getRepository(ListaPrecio);
  const lista = await listaRepo.save(
    listaRepo.create({
      organizacionId: org.id,
      nombre: 'General',
      codigo: 'GENERAL',
      monedaId: org.monedaBaseId,
      esPredeterminada: true,
      estadoRegistro: EstadoRegistro.ACTIVO,
      ...audit,
    }),
  );

  const cfg = pack.configuracionCotizacion;
  const cfgRepo = ds.getRepository(ConfiguracionCotizacion);
  await cfgRepo.save(
    cfgRepo.create({
      organizacionId: org.id,
      vigenciaHorasPredeterminada: cfg.vigenciaHorasPredeterminada,
      aplicaImpuesto: cfg.aplicaImpuesto,
      porcentajeImpuesto: cfg.porcentajeImpuesto,
      preciosIncluyenImpuesto: cfg.preciosIncluyenImpuesto,
      decimalesRedondeo: cfg.decimalesRedondeo,
      modoRedondeo: mapModoRedondeo(cfg.modoRedondeo),
      mostrarDescuentoDetallado: cfg.mostrarDescuentoDetallado,
      permiteSobrescribirPrecio: cfg.permiteSobrescribirPrecio,
      listaPrecioPredeterminadaId: lista.id,
      ...audit,
    }),
  );

  const identidad: Record<string, unknown> = {
    nombreComercial: org.nombre,
    telefonos: org.telefono ? [org.telefono] : [],
  };
  if (org.razonSocial) identidad.razonSocial = org.razonSocial;
  if (org.identificacionFiscal) {
    identidad.identificacionFiscal = org.identificacionFiscal;
  }
  if (org.direccion) identidad.direccion = org.direccion;
  if (org.email) identidad.email = org.email;

  const plantillaRepo = ds.getRepository(PlantillaDocumento);
  await plantillaRepo.save(
    plantillaRepo.create({
      organizacionId: org.id,
      nombre: 'Predeterminada',
      version: 1,
      esPredeterminada: true,
      configuracion: {
        identidad,
        ...pack.plantillaDocumento,
      },
      estadoRegistro: EstadoRegistro.ACTIVO,
      ...audit,
    }),
  );

  console.log('Pack FERRETERIA aplicado a la organización demo');
}

async function asegurarUsuarioDemo(params: {
  usuarioRepo: Repository<Usuario>;
  usuarioPerfilRepo: Repository<UsuarioPerfil>;
  usuarioSucursalRepo: Repository<UsuarioSucursal>;
  organizacionId: string;
  sucursalId: string;
  perfilId: string;
  email: string;
  password: string;
  nombreCompleto: string;
}) {
  const {
    usuarioRepo,
    usuarioPerfilRepo,
    usuarioSucursalRepo,
    organizacionId,
    sucursalId,
    perfilId,
    email,
    password,
    nombreCompleto,
  } = params;

  let user = await usuarioRepo.findOne({ where: { email } });
  if (!user) {
    const passwordHash = await bcrypt.hash(password, 12);
    user = await usuarioRepo.save(
      usuarioRepo.create({
        organizacionId,
        nombreCompleto,
        email,
        passwordHash,
        // Acceso inmediato para revisión local; en producción se crea vía panel.
        debeCambiarPassword: false,
        estadoRegistro: EstadoRegistro.ACTIVO,
      }),
    );
    console.log(`Usuario demo creado: ${email}`);
  }

  const vinculoPerfil = await usuarioPerfilRepo.findOne({
    where: { usuarioId: user.id, perfilId },
  });
  if (!vinculoPerfil) {
    await usuarioPerfilRepo.save(
      usuarioPerfilRepo.create({ usuarioId: user.id, perfilId }),
    );
  }

  const vinculoSucursal = await usuarioSucursalRepo.findOne({
    where: { usuarioId: user.id, sucursalId },
  });
  if (!vinculoSucursal) {
    await usuarioSucursalRepo.save(
      usuarioSucursalRepo.create({ usuarioId: user.id, sucursalId }),
    );
  }

  return user;
}

async function asegurarCatalogoDemo(ds: DataSource, org: Organizacion) {
  const marcaRepo = ds.getRepository(Marca);
  let marca = await marcaRepo.findOne({
    where: { organizacionId: org.id, nombre: 'Genérico' },
  });
  if (!marca) {
    marca = await marcaRepo.save(
      marcaRepo.create({
        organizacionId: org.id,
        nombre: 'Genérico',
        estadoRegistro: EstadoRegistro.ACTIVO,
      }),
    );
  }

  const catRepo = ds.getRepository(Categoria);
  const undRepo = ds.getRepository(UnidadMedida);
  const itemRepo = ds.getRepository(Item);
  const precioRepo = ds.getRepository(PrecioItem);
  const aliasRepo = ds.getRepository(ItemAlias);
  const listaRepo = ds.getRepository(ListaPrecio);

  const lista = await listaRepo.findOneOrFail({
    where: { organizacionId: org.id, codigo: 'GENERAL' },
  });

  const categorias = await catRepo.find({ where: { organizacionId: org.id } });
  const porNombreCat = new Map(categorias.map((c) => [c.nombre.toLowerCase(), c]));

  const unidades = await undRepo.find({ where: { organizacionId: org.id } });
  const porCodigoUnd = new Map(unidades.map((u) => [u.codigo, u]));

  for (const def of ITEMS_DEMO) {
    const unidad = porCodigoUnd.get(def.unidadCodigo);
    if (!unidad) {
      console.warn(`Seed demo: unidad ${def.unidadCodigo} no encontrada; se omite ${def.sku}`);
      continue;
    }
    const categoria = porNombreCat.get(def.categoriaNombre.toLowerCase());
    let item = await itemRepo.findOne({
      where: { organizacionId: org.id, sku: def.sku },
    });
    if (!item) {
      item = await itemRepo.save(
        itemRepo.create({
          organizacionId: org.id,
          sku: def.sku,
          nombre: def.nombre,
          unidadMedidaId: unidad.id,
          categoriaId: categoria?.id ?? null,
          marcaId: def.marcaNombre ? marca.id : null,
          tipoItem: TipoItem.FUNGIBLE,
          atributos: def.atributos ?? {},
          textoBusqueda: normalizarTextoBusqueda(
            def.nombre,
            def.sku,
            ...(def.aliases ?? []),
          ),
          controlaStock: false,
          estadoRegistro: EstadoRegistro.ACTIVO,
        }),
      );
    }

    const precio = await precioRepo.findOne({
      where: { listaPrecioId: lista.id, itemId: item.id },
    });
    if (!precio) {
      await precioRepo.save(
        precioRepo.create({
          organizacionId: org.id,
          listaPrecioId: lista.id,
          itemId: item.id,
          precio: def.precio,
          estadoRegistro: EstadoRegistro.ACTIVO,
        }),
      );
    }

    for (const alias of def.aliases ?? []) {
      const normalizado = normalizarTexto(alias);
      const existe = await aliasRepo.findOne({
        where: { itemId: item.id, normalizado },
      });
      if (!existe) {
        await aliasRepo.save(
          aliasRepo.create({
            organizacionId: org.id,
            itemId: item.id,
            alias,
            normalizado,
            origen: OrigenAlias.IMPORTADO,
            estadoRegistro: EstadoRegistro.ACTIVO,
          }),
        );
      }
    }
  }

  console.log(`Catálogo demo: ${ITEMS_DEMO.length} items (idempotente)`);
}

async function asegurarClienteDemo(ds: DataSource, org: Organizacion) {
  const clienteRepo = ds.getRepository(Cliente);
  const listaRepo = ds.getRepository(ListaPrecio);
  const lista = await listaRepo.findOne({
    where: { organizacionId: org.id, esPredeterminada: true },
  });

  const nombre = 'Cliente Mostrador';
  let cliente = await clienteRepo.findOne({
    where: { organizacionId: org.id, nombre },
  });
  if (!cliente) {
    cliente = await clienteRepo.save(
      clienteRepo.create({
        organizacionId: org.id,
        nombre,
        telefonoWhatsapp: '+584121234567',
        email: 'cliente@demo.local',
        listaPrecioId: lista?.id ?? null,
        notas: 'Cliente de prueba para revisión del flujo de cotización.',
        estadoRegistro: EstadoRegistro.ACTIVO,
      }),
    );
    console.log('Cliente demo creado: Cliente Mostrador');
  }
  return cliente;
}

async function asegurarTasaDemo(ds: DataSource, org: Organizacion) {
  const monedaRepo = ds.getRepository(Moneda);
  const tasaRepo = ds.getRepository(TasaCambio);
  const usd = await monedaRepo.findOneOrFail({ where: { codigoIso: 'USD' } });
  const ves = await monedaRepo.findOneOrFail({ where: { codigoIso: 'VES' } });

  if (!org.monedaPresentacionId) {
    org.monedaPresentacionId = ves.id;
    await ds.getRepository(Organizacion).save(org);
  }

  const hoy = new Date().toISOString().slice(0, 10);
  const existe = await tasaRepo.findOne({
    where: {
      organizacionId: org.id,
      monedaOrigenId: usd.id,
      monedaDestinoId: ves.id,
      fechaVigencia: hoy,
    },
  });
  if (!existe) {
    await tasaRepo.save(
      tasaRepo.create({
        organizacionId: org.id,
        monedaOrigenId: usd.id,
        monedaDestinoId: ves.id,
        valor: '36.500000',
        fechaVigencia: hoy,
        fuente: FuenteTasaCambio.MANUAL,
        estadoRegistro: EstadoRegistro.ACTIVO,
      }),
    );
    console.log(`Tasa demo USD→VES ${hoy}: 36.500000`);
  }
}

export async function asegurarDatosDemoFerreteria(params: {
  ds: DataSource;
  perfilAdminOrgId: string;
  perfilCotizadorId: string;
  createdById: string | null;
}) {
  if (!demoHabilitado()) {
    console.log('SEED_DEMO=false: se omite el enriquecimiento de la organización demo.');
    return;
  }

  const { ds, perfilAdminOrgId, perfilCotizadorId, createdById } = params;
  const orgRepo = ds.getRepository(Organizacion);
  const org = await orgRepo.findOne({ where: { nombre: ORG_DEMO_NOMBRE } });
  if (!org) {
    console.warn('Organización demo no encontrada; no hay datos de prueba.');
    return;
  }

  const pack = getPack('FERRETERIA');
  await asegurarPackDemo(ds, org, pack, createdById);

  const sucursalRepo = ds.getRepository(Sucursal);
  const sucursal = await sucursalRepo.findOneOrFail({
    where: { organizacionId: org.id, esPrincipal: true },
  });

  const passwordDemo =
    process.env.SEED_DEMO_ADMIN_PASSWORD || process.env.SEED_ADMIN_PASSWORD;
  if (!passwordDemo) {
    throw new Error('SEED_ADMIN_PASSWORD es obligatoria para usuarios demo.');
  }

  const emailAdmin = process.env.SEED_DEMO_ADMIN_EMAIL?.trim() || 'admin@demo.local';
  const emailCotizador =
    process.env.SEED_DEMO_COTIZADOR_EMAIL?.trim() || 'cotizador@demo.local';
  const passwordCotizador =
    process.env.SEED_DEMO_COTIZADOR_PASSWORD || passwordDemo;

  const usuarioRepo = ds.getRepository(Usuario);
  const usuarioPerfilRepo = ds.getRepository(UsuarioPerfil);
  const usuarioSucursalRepo = ds.getRepository(UsuarioSucursal);

  await asegurarUsuarioDemo({
    usuarioRepo,
    usuarioPerfilRepo,
    usuarioSucursalRepo,
    organizacionId: org.id,
    sucursalId: sucursal.id,
    perfilId: perfilAdminOrgId,
    email: emailAdmin,
    password: passwordDemo,
    nombreCompleto: 'Administrador Demo',
  });

  await asegurarUsuarioDemo({
    usuarioRepo,
    usuarioPerfilRepo,
    usuarioSucursalRepo,
    organizacionId: org.id,
    sucursalId: sucursal.id,
    perfilId: perfilCotizadorId,
    email: emailCotizador,
    password: passwordCotizador,
    nombreCompleto: 'Cotizador Demo',
  });

  // Si el admin demo ya existía con debeCambiarPassword, aflojarlo para revisión local.
  const adminExistente = await usuarioRepo.findOne({ where: { email: emailAdmin } });
  if (adminExistente?.debeCambiarPassword) {
    adminExistente.debeCambiarPassword = false;
    await usuarioRepo.save(adminExistente);
  }

  await asegurarCatalogoDemo(ds, org);
  await asegurarClienteDemo(ds, org);
  await asegurarTasaDemo(ds, org);

  console.log('Datos de demostración listos (usuarios, catálogo, cliente, tasa).');
}
