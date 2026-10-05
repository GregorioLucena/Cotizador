/**
 * Datos de demostración para la organización "Demo Ferretería" (Ferretería El Tornillo).
 * Idempotente: se puede repetir `pnpm db:seed` sin duplicar.
 *
 * Desactivar con SEED_DEMO=false.
 */
import bcrypt from 'bcryptjs';
import { formatImporte, normalizarTexto, normalizarTextoBusqueda } from '@cotizador/shared';
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
const NOMBRE_COMERCIAL_DEMO = 'Ferretería El Tornillo';

/** Listas de precio demo: General (mostrador), Mayor y Contratista. */
const LISTAS_DEMO = [
  {
    codigo: 'GENERAL',
    nombre: 'General (mostrador)',
    esPredeterminada: true,
    /** Multiplicador sobre el precio base del item. */
    factor: 1,
  },
  {
    codigo: 'MAYOR',
    nombre: 'Mayorista',
    esPredeterminada: false,
    factor: 0.85,
  },
  {
    codigo: 'CONTRATISTA',
    nombre: 'Contratista',
    esPredeterminada: false,
    factor: 0.9,
  },
] as const;

type DemoItemDef = {
  sku: string;
  nombre: string;
  unidadCodigo: string;
  categoriaNombre: string;
  marcaNombre?: string;
  /** Precio base en lista GENERAL (4 decimales). */
  precio: string;
  aliases?: string[];
  atributos?: Record<string, unknown>;
};

const MARCAS_DEMO = ['Genérico', 'Pavco', 'Truper', 'Condumex', '3M'] as const;

const ITEMS_DEMO: DemoItemDef[] = [
  // Plomería
  {
    sku: 'PVC-TUB-050-3M',
    nombre: 'Tubo PVC 1/2" × 3m',
    unidadCodigo: 'UND',
    categoriaNombre: 'Tuberia',
    marcaNombre: 'Pavco',
    precio: '11.2500',
    aliases: ['tubo de media', 'tubos de 1/2', 'tubo pvc media'],
    atributos: { diametro: '1/2"', material: 'PVC', medida: '3m' },
  },
  {
    sku: 'PVC-TUB-075-3M',
    nombre: 'Tubo PVC 3/4" × 3m',
    unidadCodigo: 'UND',
    categoriaNombre: 'Tuberia',
    marcaNombre: 'Pavco',
    precio: '14.8000',
    aliases: ['tubo de 3/4', 'tubo pvc 3/4'],
    atributos: { diametro: '3/4"', material: 'PVC', medida: '3m' },
  },
  {
    sku: 'PVC-TUB-100-3M',
    nombre: 'Tubo PVC 1" × 3m',
    unidadCodigo: 'UND',
    categoriaNombre: 'Tuberia',
    marcaNombre: 'Pavco',
    precio: '18.5000',
    aliases: ['tubo de una', 'tubo pvc 1'],
    atributos: { diametro: '1"', material: 'PVC', medida: '3m' },
  },
  {
    sku: 'PVC-COD-050',
    nombre: 'Codo PVC 1/2"',
    unidadCodigo: 'UND',
    categoriaNombre: 'Conexiones',
    marcaNombre: 'Pavco',
    precio: '0.8500',
    aliases: ['codo', 'codos', 'codo de media'],
    atributos: { diametro: '1/2"', material: 'PVC' },
  },
  {
    sku: 'PVC-COD-075',
    nombre: 'Codo PVC 3/4"',
    unidadCodigo: 'UND',
    categoriaNombre: 'Conexiones',
    marcaNombre: 'Pavco',
    precio: '1.1500',
    aliases: ['codo 3/4', 'codos de 3/4'],
    atributos: { diametro: '3/4"', material: 'PVC' },
  },
  {
    sku: 'PVC-TEE-050',
    nombre: 'Tee PVC 1/2"',
    unidadCodigo: 'UND',
    categoriaNombre: 'Conexiones',
    marcaNombre: 'Pavco',
    precio: '1.0500',
    aliases: ['tee', 'te de media', 'tee pvc'],
    atributos: { diametro: '1/2"', material: 'PVC' },
  },
  {
    sku: 'PVC-UNI-050',
    nombre: 'Unión PVC 1/2"',
    unidadCodigo: 'UND',
    categoriaNombre: 'Conexiones',
    marcaNombre: 'Pavco',
    precio: '0.6500',
    aliases: ['union pvc', 'coupler media'],
    atributos: { diametro: '1/2"', material: 'PVC' },
  },
  {
    sku: 'VAL-BOLA-050',
    nombre: 'Válvula de bola PVC 1/2"',
    unidadCodigo: 'UND',
    categoriaNombre: 'Llaves y valvulas',
    marcaNombre: 'Genérico',
    precio: '4.5000',
    aliases: ['valvula de bola', 'llave de bola', 'valvula pvc'],
    atributos: { diametro: '1/2"', material: 'PVC' },
  },
  {
    sku: 'LLA-PASO-050',
    nombre: 'Llave de paso 1/2"',
    unidadCodigo: 'UND',
    categoriaNombre: 'Llaves y valvulas',
    marcaNombre: 'Genérico',
    precio: '6.2000',
    aliases: ['llave de paso', 'llave de corte'],
    atributos: { diametro: '1/2"' },
  },
  // Adhesivos
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
    sku: 'SIL-TRANS-280',
    nombre: 'Silicona transparente 280 ml',
    unidadCodigo: 'UND',
    categoriaNombre: 'Siliconas',
    marcaNombre: '3M',
    precio: '5.9000',
    aliases: ['silicona', 'silicon transparente'],
    atributos: { presentacion: '280 ml', color: 'transparente' },
  },
  {
    sku: 'TEF-1/2',
    nombre: 'Cinta teflón 1/2"',
    unidadCodigo: 'UND',
    categoriaNombre: 'Cintas',
    marcaNombre: 'Genérico',
    precio: '1.2000',
    aliases: ['teflon', 'cinta de plomero'],
  },
  // Electricidad
  {
    sku: 'CAB-12AWG',
    nombre: 'Cable THW 12 AWG',
    unidadCodigo: 'M',
    categoriaNombre: 'Cables',
    marcaNombre: 'Condumex',
    precio: '0.9500',
    aliases: ['cable numero 12', 'cable 12', 'cable thw 12'],
  },
  {
    sku: 'CAB-14AWG',
    nombre: 'Cable THW 14 AWG',
    unidadCodigo: 'M',
    categoriaNombre: 'Cables',
    marcaNombre: 'Condumex',
    precio: '0.7200',
    aliases: ['cable numero 14', 'cable 14'],
  },
  {
    sku: 'CAB-10AWG',
    nombre: 'Cable THW 10 AWG',
    unidadCodigo: 'M',
    categoriaNombre: 'Cables',
    marcaNombre: 'Condumex',
    precio: '1.4500',
    aliases: ['cable numero 10', 'cable 10'],
  },
  {
    sku: 'TOM-DOBLE',
    nombre: 'Tomacorriente doble 15A',
    unidadCodigo: 'UND',
    categoriaNombre: 'Tomacorrientes e interruptores',
    marcaNombre: 'Genérico',
    precio: '3.8000',
    aliases: ['tomacorriente', 'toma doble', 'enchufe doble'],
  },
  {
    sku: 'INT-SENC',
    nombre: 'Interruptor sencillo',
    unidadCodigo: 'UND',
    categoriaNombre: 'Tomacorrientes e interruptores',
    marcaNombre: 'Genérico',
    precio: '2.4500',
    aliases: ['interruptor', 'switch', 'apagador'],
  },
  {
    sku: 'LED-BULB-9W',
    nombre: 'Bombillo LED 9W',
    unidadCodigo: 'UND',
    categoriaNombre: 'Iluminacion',
    marcaNombre: 'Genérico',
    precio: '2.9000',
    aliases: ['bombillo', 'bombillo led', 'foco led'],
  },
  {
    sku: 'BRK-20A',
    nombre: 'Breaker 20A unipolar',
    unidadCodigo: 'UND',
    categoriaNombre: 'Tableros y breakers',
    marcaNombre: 'Genérico',
    precio: '7.5000',
    aliases: ['breaker', 'breaker 20', 'interruptor termomagnetico'],
  },
  // Tornillería
  {
    sku: 'RAM-CHAZA',
    nombre: 'Ramplug plástico',
    unidadCodigo: 'UND',
    categoriaNombre: 'Anclajes y ramplugs',
    marcaNombre: 'Genérico',
    precio: '0.1500',
    aliases: ['chaza', 'ramplug', 'taco plastico'],
  },
  {
    sku: 'TOR-HEX-14',
    nombre: 'Tornillo hex 1/4" × 1"',
    unidadCodigo: 'UND',
    categoriaNombre: 'Tornillos',
    marcaNombre: 'Truper',
    precio: '0.1800',
    aliases: ['tornillo hex', 'tornillo 1/4', 'tornillo hexagonal'],
    atributos: { diametro: '1/4"', medida: '1"' },
  },
  {
    sku: 'TOR-AUT-8X1',
    nombre: 'Tornillo autorroscante #8 × 1"',
    unidadCodigo: 'UND',
    categoriaNombre: 'Tornillos',
    marcaNombre: 'Truper',
    precio: '0.0800',
    aliases: ['autorroscante', 'tornillo drywall', 'tornillo lamina'],
  },
  {
    sku: 'TUE-14',
    nombre: 'Tuerca hexagonal 1/4"',
    unidadCodigo: 'UND',
    categoriaNombre: 'Tuercas y arandelas',
    marcaNombre: 'Truper',
    precio: '0.0900',
    aliases: ['tuerca', 'tuerca 1/4'],
    atributos: { diametro: '1/4"' },
  },
  {
    sku: 'CLA-2',
    nombre: 'Clavo 2"',
    unidadCodigo: 'KG',
    categoriaNombre: 'Clavos',
    marcaNombre: 'Genérico',
    precio: '3.2000',
    aliases: ['clavos', 'clavo de 2'],
    atributos: { medida: '2"' },
  },
  // Herramientas
  {
    sku: 'HER-MART-16',
    nombre: 'Martillo de uña 16 oz',
    unidadCodigo: 'UND',
    categoriaNombre: 'Manuales',
    marcaNombre: 'Truper',
    precio: '12.5000',
    aliases: ['martillo', 'martillo de una'],
  },
  {
    sku: 'HER-DEST-PH2',
    nombre: 'Destornillador Phillips #2',
    unidadCodigo: 'UND',
    categoriaNombre: 'Manuales',
    marcaNombre: 'Truper',
    precio: '4.1000',
    aliases: ['destornillador', 'desarmador phillips'],
  },
  {
    sku: 'HER-CINTA-5M',
    nombre: 'Cinta métrica 5 m',
    unidadCodigo: 'UND',
    categoriaNombre: 'Medicion',
    marcaNombre: 'Truper',
    precio: '6.7500',
    aliases: ['metro', 'cinta metrica', 'flexometro'],
  },
  // Pintura / construcción
  {
    sku: 'PIN-CAU-BCO-4G',
    nombre: 'Pintura de caucho blanca 4 gal',
    unidadCodigo: 'UND',
    categoriaNombre: 'Pintura de caucho',
    marcaNombre: 'Genérico',
    precio: '28.0000',
    aliases: ['pintura de caucho', 'pintura blanca', 'caucho blanco'],
    atributos: { color: 'blanco', presentacion: '4 gal' },
  },
  {
    sku: 'CEM-GRIS-42.5',
    nombre: 'Cemento gris 42.5 kg',
    unidadCodigo: 'SACO',
    categoriaNombre: 'Cemento y agregados',
    marcaNombre: 'Genérico',
    precio: '7.8000',
    aliases: ['cemento', 'saco de cemento'],
    atributos: { presentacion: '42.5 kg' },
  },
  {
    sku: 'CAB-3/8',
    nombre: 'Cabilla 3/8"',
    unidadCodigo: 'UND',
    categoriaNombre: 'Acero de refuerzo',
    marcaNombre: 'Genérico',
    precio: '4.2000',
    aliases: ['varilla', 'cabilla', 'varilla 3/8'],
    atributos: { diametro: '3/8"', material: 'ACERO' },
  },
  // Ferretería general
  {
    sku: 'CAN-40MM',
    nombre: 'Candado 40 mm',
    unidadCodigo: 'UND',
    categoriaNombre: 'Candados y cerraduras',
    marcaNombre: 'Genérico',
    precio: '5.5000',
    aliases: ['candado', 'candado chico'],
  },
];

function precioConFactor(precioBase: string, factor: number): string {
  const n = Number(precioBase);
  if (!Number.isFinite(n)) return precioBase;
  return formatImporte(n * factor);
}

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
    nombreComercial: NOMBRE_COMERCIAL_DEMO,
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
        debeCambiarPassword: true,
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

async function asegurarListasDemo(
  ds: DataSource,
  org: Organizacion,
): Promise<Map<string, ListaPrecio>> {
  const listaRepo = ds.getRepository(ListaPrecio);
  const porCodigo = new Map<string, ListaPrecio>();

  for (const def of LISTAS_DEMO) {
    let lista = await listaRepo.findOne({
      where: { organizacionId: org.id, codigo: def.codigo },
    });
    if (!lista) {
      lista = await listaRepo.save(
        listaRepo.create({
          organizacionId: org.id,
          nombre: def.nombre,
          codigo: def.codigo,
          monedaId: org.monedaBaseId,
          esPredeterminada: def.esPredeterminada,
          estadoRegistro: EstadoRegistro.ACTIVO,
        }),
      );
      console.log(`Lista demo creada: ${def.codigo} (${def.nombre})`);
    } else if (lista.nombre !== def.nombre) {
      lista.nombre = def.nombre;
      await listaRepo.save(lista);
    }
    porCodigo.set(def.codigo, lista);
  }

  // Una sola predeterminada: GENERAL
  const general = porCodigo.get('GENERAL');
  if (general && !general.esPredeterminada) {
    await listaRepo.update(
      { organizacionId: org.id, esPredeterminada: true },
      { esPredeterminada: false },
    );
    general.esPredeterminada = true;
    await listaRepo.save(general);
  }

  const cfgRepo = ds.getRepository(ConfiguracionCotizacion);
  const cfg = await cfgRepo.findOne({ where: { organizacionId: org.id } });
  if (cfg && general && cfg.listaPrecioPredeterminadaId !== general.id) {
    cfg.listaPrecioPredeterminadaId = general.id;
    await cfgRepo.save(cfg);
  }

  return porCodigo;
}

async function asegurarMarcasDemo(
  ds: DataSource,
  org: Organizacion,
): Promise<Map<string, Marca>> {
  const marcaRepo = ds.getRepository(Marca);
  const porNombre = new Map<string, Marca>();
  for (const nombre of MARCAS_DEMO) {
    let marca = await marcaRepo.findOne({
      where: { organizacionId: org.id, nombre },
    });
    if (!marca) {
      marca = await marcaRepo.save(
        marcaRepo.create({
          organizacionId: org.id,
          nombre,
          estadoRegistro: EstadoRegistro.ACTIVO,
        }),
      );
    }
    porNombre.set(nombre, marca);
  }
  return porNombre;
}

async function asegurarCatalogoDemo(ds: DataSource, org: Organizacion) {
  const marcas = await asegurarMarcasDemo(ds, org);
  const listas = await asegurarListasDemo(ds, org);

  const catRepo = ds.getRepository(Categoria);
  const undRepo = ds.getRepository(UnidadMedida);
  const itemRepo = ds.getRepository(Item);
  const precioRepo = ds.getRepository(PrecioItem);
  const aliasRepo = ds.getRepository(ItemAlias);

  const categorias = await catRepo.find({ where: { organizacionId: org.id } });
  const porNombreCat = new Map(
    categorias.map((c) => [c.nombre.toLowerCase(), c]),
  );

  const unidades = await undRepo.find({ where: { organizacionId: org.id } });
  const porCodigoUnd = new Map(unidades.map((u) => [u.codigo, u]));

  let creados = 0;
  for (const def of ITEMS_DEMO) {
    const unidad = porCodigoUnd.get(def.unidadCodigo);
    if (!unidad) {
      console.warn(
        `Seed demo: unidad ${def.unidadCodigo} no encontrada; se omite ${def.sku}`,
      );
      continue;
    }
    const categoria = porNombreCat.get(def.categoriaNombre.toLowerCase());
    const marca = def.marcaNombre ? marcas.get(def.marcaNombre) : undefined;

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
          marcaId: marca?.id ?? null,
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
      creados += 1;
    }

    for (const listaDef of LISTAS_DEMO) {
      const lista = listas.get(listaDef.codigo);
      if (!lista) continue;
      const precioValor = precioConFactor(def.precio, listaDef.factor);
      const precio = await precioRepo.findOne({
        where: { listaPrecioId: lista.id, itemId: item.id },
      });
      if (!precio) {
        await precioRepo.save(
          precioRepo.create({
            organizacionId: org.id,
            listaPrecioId: lista.id,
            itemId: item.id,
            precio: precioValor,
            estadoRegistro: EstadoRegistro.ACTIVO,
          }),
        );
      }
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

  console.log(
    `Catálogo demo: ${ITEMS_DEMO.length} items definidos` +
      (creados > 0 ? ` (${creados} nuevos)` : ' (ya existían)') +
      `; ${LISTAS_DEMO.length} listas de precio`,
  );
}

async function asegurarClientesDemo(ds: DataSource, org: Organizacion) {
  const clienteRepo = ds.getRepository(Cliente);
  const listaRepo = ds.getRepository(ListaPrecio);

  const clientesDemo = [
    {
      nombre: 'Cliente Mostrador',
      telefonoWhatsapp: '+584121234567',
      email: 'cliente@demo.local',
      listaCodigo: 'GENERAL',
      notas: 'Cliente de mostrador — lista General.',
    },
    {
      nombre: 'Distribuidora Mayorista Norte',
      telefonoWhatsapp: '+584141112233',
      email: 'mayor@demo.local',
      listaCodigo: 'MAYOR',
      notas: 'Cliente mayorista — lista Mayorista (−15%).',
    },
    {
      nombre: 'Constructora El Puente',
      telefonoWhatsapp: '+584161445566',
      email: 'contratista@demo.local',
      listaCodigo: 'CONTRATISTA',
      notas: 'Cliente contratista — lista Contratista (−10%).',
    },
  ] as const;

  for (const def of clientesDemo) {
    const lista = await listaRepo.findOne({
      where: { organizacionId: org.id, codigo: def.listaCodigo },
    });
    let cliente = await clienteRepo.findOne({
      where: { organizacionId: org.id, nombre: def.nombre },
    });
    if (!cliente) {
      cliente = await clienteRepo.save(
        clienteRepo.create({
          organizacionId: org.id,
          nombre: def.nombre,
          telefonoWhatsapp: def.telefonoWhatsapp,
          email: def.email,
          listaPrecioId: lista?.id ?? null,
          notas: def.notas,
          estadoRegistro: EstadoRegistro.ACTIVO,
        }),
      );
      console.log(`Cliente demo creado: ${def.nombre} → ${def.listaCodigo}`);
    } else if (lista && cliente.listaPrecioId !== lista.id) {
      cliente.listaPrecioId = lista.id;
      await clienteRepo.save(cliente);
    }
  }
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

  const adminExistente = await usuarioRepo.findOne({ where: { email: emailAdmin } });
  if (adminExistente?.debeCambiarPassword) {
    adminExistente.debeCambiarPassword = false;
    await usuarioRepo.save(adminExistente);
  }

  await asegurarCatalogoDemo(ds, org);
  await asegurarClientesDemo(ds, org);
  await asegurarTasaDemo(ds, org);

  console.log(
    'Datos de demostración listos (usuarios, catálogo, 3 listas, clientes, tasa).',
  );
}
