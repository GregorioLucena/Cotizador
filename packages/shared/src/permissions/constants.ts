export const PERMISOS = {
  PLATAFORMA_ORGANIZACIONES_VER: 'plataforma.organizaciones.ver',
  PLATAFORMA_ORGANIZACIONES_CREAR: 'plataforma.organizaciones.crear',
  PLATAFORMA_ORGANIZACIONES_EDITAR: 'plataforma.organizaciones.editar',
  PLATAFORMA_USUARIOS_ADMINISTRAR: 'plataforma.usuarios.administrar',
  PLATAFORMA_METRICAS_VER: 'plataforma.metricas.ver',

  CONFIGURACION_ORGANIZACION_VER: 'configuracion.organizacion.ver',
  CONFIGURACION_ORGANIZACION_ADMINISTRAR: 'configuracion.organizacion.administrar',
  CONFIGURACION_SUCURSALES_VER: 'configuracion.sucursales.ver',
  CONFIGURACION_SUCURSALES_ADMINISTRAR: 'configuracion.sucursales.administrar',

  SEGURIDAD_USUARIOS_VER: 'seguridad.usuarios.ver',
  SEGURIDAD_USUARIOS_CREAR: 'seguridad.usuarios.crear',
  SEGURIDAD_USUARIOS_EDITAR: 'seguridad.usuarios.editar',
  SEGURIDAD_USUARIOS_RESTABLECER_CLAVE: 'seguridad.usuarios.restablecer_clave',

  CATALOGO_MAESTRAS_VER: 'catalogo.maestras.ver',
  CATALOGO_MAESTRAS_ADMINISTRAR: 'catalogo.maestras.administrar',
  CATALOGO_ITEMS_VER: 'catalogo.items.ver',
  CATALOGO_ITEMS_CREAR: 'catalogo.items.crear',
  CATALOGO_ITEMS_EDITAR: 'catalogo.items.editar',
  CATALOGO_ITEMS_IMPORTAR: 'catalogo.items.importar',
  CATALOGO_ALIAS_ADMINISTRAR: 'catalogo.alias.administrar',

  PRECIOS_LISTAS_VER: 'precios.listas.ver',
  PRECIOS_LISTAS_ADMINISTRAR: 'precios.listas.administrar',
  PRECIOS_REGLAS_ADMINISTRAR: 'precios.reglas.administrar',
  PRECIOS_TASAS_ADMINISTRAR: 'precios.tasas.administrar',

  CLIENTES_VER: 'clientes.ver',
  CLIENTES_CREAR: 'clientes.crear',
  CLIENTES_EDITAR: 'clientes.editar',

  COTIZACIONES_VER: 'cotizaciones.ver',
  COTIZACIONES_CREAR: 'cotizaciones.crear',
  COTIZACIONES_EDITAR: 'cotizaciones.editar',
  COTIZACIONES_SOBRESCRIBIR_PRECIO: 'cotizaciones.sobrescribir_precio',
  COTIZACIONES_APROBAR: 'cotizaciones.aprobar',
  COTIZACIONES_GENERAR_DOCUMENTO: 'cotizaciones.generar_documento',
  COTIZACIONES_REGISTRAR_RESULTADO: 'cotizaciones.registrar_resultado',
  COTIZACIONES_ANULAR: 'cotizaciones.anular',

  PLANTILLAS_VER: 'plantillas.ver',
  PLANTILLAS_ADMINISTRAR: 'plantillas.administrar',

  REPORTES_VER: 'reportes.ver',
} as const;

export type PermisoCodigo = (typeof PERMISOS)[keyof typeof PERMISOS];

export const PERMISOS_DESCRIPCION: Record<PermisoCodigo, string> = {
  [PERMISOS.PLATAFORMA_ORGANIZACIONES_VER]: 'Listar y ver organizaciones',
  [PERMISOS.PLATAFORMA_ORGANIZACIONES_CREAR]: 'Registrar una organizacion y provisionarla',
  [PERMISOS.PLATAFORMA_ORGANIZACIONES_EDITAR]: 'Editar datos y estado de una organizacion',
  [PERMISOS.PLATAFORMA_USUARIOS_ADMINISTRAR]:
    'Crear el usuario administrador inicial de una organizacion',
  [PERMISOS.PLATAFORMA_METRICAS_VER]: 'Ver metricas agregadas de la plataforma',
  [PERMISOS.CONFIGURACION_ORGANIZACION_VER]: 'Ver la configuracion de la organizacion',
  [PERMISOS.CONFIGURACION_ORGANIZACION_ADMINISTRAR]:
    'Editar datos, monedas, umbrales y configuracion de cotizacion',
  [PERMISOS.CONFIGURACION_SUCURSALES_VER]: 'Ver sucursales',
  [PERMISOS.CONFIGURACION_SUCURSALES_ADMINISTRAR]: 'Crear y editar sucursales',
  [PERMISOS.SEGURIDAD_USUARIOS_VER]: 'Ver usuarios de la organizacion',
  [PERMISOS.SEGURIDAD_USUARIOS_CREAR]: 'Crear usuarios',
  [PERMISOS.SEGURIDAD_USUARIOS_EDITAR]: 'Editar usuarios, perfiles y accesos',
  [PERMISOS.SEGURIDAD_USUARIOS_RESTABLECER_CLAVE]:
    'Forzar el cambio de contraseña de un usuario',
  [PERMISOS.CATALOGO_MAESTRAS_VER]:
    'Ver categorias, marcas, unidades y definiciones de atributo',
  [PERMISOS.CATALOGO_MAESTRAS_ADMINISTRAR]:
    'Administrar categorias, marcas, unidades y definiciones de atributo',
  [PERMISOS.CATALOGO_ITEMS_VER]: 'Ver y buscar items',
  [PERMISOS.CATALOGO_ITEMS_CREAR]: 'Crear items',
  [PERMISOS.CATALOGO_ITEMS_EDITAR]: 'Editar e inactivar items',
  [PERMISOS.CATALOGO_ITEMS_IMPORTAR]: 'Importar catalogo, precios y alias desde archivo',
  [PERMISOS.CATALOGO_ALIAS_ADMINISTRAR]: 'Crear, editar y depurar alias',
  [PERMISOS.PRECIOS_LISTAS_VER]: 'Ver listas y precios',
  [PERMISOS.PRECIOS_LISTAS_ADMINISTRAR]: 'Administrar listas y precios de items',
  [PERMISOS.PRECIOS_REGLAS_ADMINISTRAR]: 'Administrar reglas de descuento',
  [PERMISOS.PRECIOS_TASAS_ADMINISTRAR]: 'Actualizar tasas de cambio',
  [PERMISOS.CLIENTES_VER]: 'Ver clientes',
  [PERMISOS.CLIENTES_CREAR]: 'Crear clientes',
  [PERMISOS.CLIENTES_EDITAR]: 'Editar clientes',
  [PERMISOS.COTIZACIONES_VER]: 'Ver cotizaciones e historial',
  [PERMISOS.COTIZACIONES_CREAR]: 'Capturar solicitudes y generar borradores',
  [PERMISOS.COTIZACIONES_EDITAR]: 'Editar lineas de un borrador',
  [PERMISOS.COTIZACIONES_SOBRESCRIBIR_PRECIO]:
    'Sobrescribir manualmente el precio de una linea',
  [PERMISOS.COTIZACIONES_APROBAR]: 'Aprobar una cotizacion',
  [PERMISOS.COTIZACIONES_GENERAR_DOCUMENTO]: 'Generar el PDF y el texto de entrega',
  [PERMISOS.COTIZACIONES_REGISTRAR_RESULTADO]: 'Marcar ganada o perdida',
  [PERMISOS.COTIZACIONES_ANULAR]: 'Anular una cotizacion con motivo',
  [PERMISOS.PLANTILLAS_VER]: 'Ver plantillas de documento',
  [PERMISOS.PLANTILLAS_ADMINISTRAR]: 'Editar la plantilla de documento',
  [PERMISOS.REPORTES_VER]: 'Ver metricas e informes de la organizacion',
};
