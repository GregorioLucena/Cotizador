# Catálogo de errores

Fuente canónica de los códigos de error de la API. Los servicios lanzan estos códigos a través de
`AppError` (y subclases) en `@cotizador/shared`; el filtro global los serializa al contrato
`{ "error": { "code", "message", "details" } }` definido en `docs/06-diseno-tecnico.md`.

Los mensajes de esta tabla son los que ve la persona en la interfaz. Van **con tildes**. Los códigos
van en `UPPER_SNAKE_CASE` **sin tildes**.

---

## Convenciones

1. **Un código, un significado.** No se reutiliza el mismo código para dos causas distintas.
2. **Identificador ajeno = no encontrado.** Si el recurso existe en otra organización, se responde el
   código `*_NO_ENCONTRADO` (o `RECURSO_NO_ENCONTRADO`) con HTTP 404. Nunca 403: no se revela la
   existencia de datos ajenos (`decisions/0001-multi-tenancy-por-organizacion.md`).
3. **HTTP canónicos:**

| HTTP | Cuándo |
|------|--------|
| 400 | Forma inválida o datos que no pasan el esquema |
| 401 | Sin autenticación o credencial/sesión inválida |
| 403 | Autenticado sin el permiso requerido |
| 404 | Recurso inexistente o de otra organización |
| 409 | Conflicto de unicidad o de estado de recurso |
| 422 | Regla de negocio incumplida con entrada bien formada |
| 502 | Fallo de un adaptador externo (IA, PDF, almacenamiento) |

4. **`details`** aporta campos concretos (clave de atributo, id del duplicado, issues de Zod). No
   sustituye a `message`.
5. **Advertencias** (p. ej. `ALIAS_REDUNDANTE`) no son errores: viajan en respuestas exitosas.
6. Todo código nuevo se agrega aquí **y** en `@cotizador/shared` en la misma PR (ver sección final).

---

## Errores genéricos

| Código | HTTP | Mensaje al usuario | Cuando ocurre |
|--------|------|--------------------|---------------|
| `VALIDACION_FALLIDA` | 400 | Los datos enviados no son válidos. Revise los campos e intente de nuevo. | El cuerpo o la query no cumplen el esquema Zod |
| `NO_AUTENTICADO` | 401 | Debe iniciar sesión para continuar. | Petición sin token de acceso o con token mal formado |
| `TOKEN_EXPIRADO` | 401 | Su sesión expiró. Vuelva a iniciar sesión. | El JWT de acceso expiró y no pudo renovarse |
| `SIN_PERMISO` | 403 | No tiene permiso para realizar esta acción. | El usuario autenticado carece del permiso requerido |
| `RECURSO_NO_ENCONTRADO` | 404 | No se encontró el recurso solicitado. | Recurso genérico inexistente o de otra organización |
| `CONTEXTO_ORGANIZACION_REQUERIDO` | 403 | Esta operación requiere el contexto de una organización. | Usuario de ámbito `PLATAFORMA` invoca un servicio de dominio |
| `OPERACION_NO_PERMITIDA_EN_ESTADO` | 422 | No se puede realizar esta operación en el estado actual. | Transición o acción incompatible con el estado del recurso |
| `SERVICIO_EXTERNO_NO_DISPONIBLE` | 502 | Un servicio externo no está disponible. Intente más tarde. | Fallo genérico de adaptador externo sin código más específico |

---

## Autenticación (`AUTH_*`)

| Código | HTTP | Mensaje al usuario | Cuando ocurre |
|--------|------|--------------------|---------------|
| `AUTH_CREDENCIALES_INVALIDAS` | 401 | Correo o contraseña incorrectos. | Correo inexistente, contraseña incorrecta, usuario inactivo u organización inactiva (mensaje idéntico en todos los casos) |
| `AUTH_SESION_INVALIDA` | 401 | Su sesión no es válida. Vuelva a iniciar sesión. | Token de refresco inexistente, rotado, revocado o expirado |
| `AUTH_SESION_REVOCADA` | 401 | Su sesión fue cerrada. Vuelva a iniciar sesión. | La sesión está marcada como revocada |
| `AUTH_CAMBIO_PASSWORD_REQUERIDO` | 403 | Debe cambiar su contraseña antes de continuar. | `debeCambiarPassword` es verdadero e invoca un endpoint distinto de perfil, cambio de contraseña o cierre de sesión |
| `AUTH_PASSWORD_DEBIL` | 400 | La contraseña no cumple los requisitos de seguridad. | Contraseña nueva o temporal fuera de la política |
| `AUTH_PASSWORD_ACTUAL_INCORRECTA` | 400 | La contraseña actual no es correcta. | El valor actual no coincide en el cambio de contraseña |
| `AUTH_PASSWORD_IGUAL_A_LA_ANTERIOR` | 422 | La contraseña nueva debe ser distinta de la actual. | La nueva coincide con la vigente |
| `AUTH_SUCURSAL_NO_ASIGNADA` | 403 | No tiene acceso a la sucursal seleccionada. | Intenta activar una sucursal fuera de `ctx.sucursalIds` |
| `AUTH_SUCURSAL_INACTIVA` | 422 | La sucursal seleccionada no está activa. | Intenta asignar o activar una sucursal inactiva |

---

## Organización (`ORGANIZACION_*`)

| Código | HTTP | Mensaje al usuario | Cuando ocurre |
|--------|------|--------------------|---------------|
| `ORGANIZACION_NO_ENCONTRADA` | 404 | No se encontró la organización indicada. | Id inexistente (ámbito plataforma) |
| `ORGANIZACION_NOMBRE_DUPLICADO` | 409 | Ya existe una organización con ese nombre. | Violación de unicidad de nombre |
| `ORGANIZACION_IDENTIFICACION_DUPLICADA` | 409 | Ya existe una organización con esa identificación fiscal. | Violación de unicidad parcial de identificación fiscal |
| `ORGANIZACION_INACTIVA` | 422 | La organización está inactiva. | Se intenta operar sobre una organización con `estadoRegistro` `INACTIVO` |
| `ORGANIZACION_VERTICAL_INVALIDO` | 400 | El vertical indicado no es válido. | Código de vertical inexistente o inactivo al provisionar |
| `ORGANIZACION_CONFIGURACION_AUSENTE` | 422 | Falta la configuración de cotización de la organización. | Provisionamiento incompleto (sin fila de configuración) |
| `ORGANIZACION_UMBRALES_INCOHERENTES` | 422 | El umbral de descarte debe ser menor que el umbral automático. | `umbralDescarte >= umbralAutomatico` |
| `ORGANIZACION_UMBRAL_FUERA_DE_RANGO` | 400 | Los umbrales deben estar entre 0 y 1. | Umbral fuera del intervalo permitido |
| `ORGANIZACION_MONEDA_PRESENTACION_IGUAL_A_BASE` | 400 | La moneda de presentación debe ser distinta de la moneda base. | Ambas monedas coinciden |
| `ORGANIZACION_CAMBIO_MONEDA_BASE_NO_CONFIRMADO` | 422 | Confirme de forma explícita el cambio de moneda base. | Cambio de moneda base sin confirmación |
| `ORGANIZACION_LOGO_FORMATO_NO_SOPORTADO` | 400 | El logo debe ser PNG, JPG o SVG. | Formato de archivo no admitido |
| `ORGANIZACION_LOGO_DEMASIADO_GRANDE` | 400 | El logo no puede superar 2 MB. | Archivo demasiado grande |
| `ORGANIZACION_LOGO_DIMENSIONES_INSUFICIENTES` | 400 | El logo debe medir al menos 200 por 200 píxeles. | PNG/JPG por debajo del mínimo |
| `IMPUESTO_PORCENTAJE_REQUERIDO` | 422 | Indique el porcentaje de impuesto o desactive su aplicación. | `aplicaImpuesto` verdadero sin porcentaje válido |
| `ORGANIZACION_SUCURSAL_NO_ENCONTRADA` | 404 | No se encontró la sucursal indicada. | Sucursal inexistente o de otra organización |
| `ORGANIZACION_SUCURSAL_NOMBRE_DUPLICADO` | 409 | Ya existe una sucursal con ese nombre. | Unicidad (`organizacionId`, `nombre`) |
| `ORGANIZACION_SUCURSAL_CODIGO_DUPLICADO` | 409 | Ya existe una sucursal con ese código. | Unicidad de código por organización |
| `ORGANIZACION_SUCURSAL_PRINCIPAL_NO_INACTIVABLE` | 422 | No se puede inactivar la sucursal principal. | Intento de inactivar la principal |
| `ORGANIZACION_SUCURSAL_EN_USO` | 422 | No se puede inactivar: hay usuarios que quedarían sin sucursal. | Inactivación dejaría usuarios sin acceso |
| `ORGANIZACION_PACK_NO_DISPONIBLE` | 422 | No hay un pack disponible para el vertical elegido. | Alta sin pack registrado para el código del vertical |
| `ORGANIZACION_PROVISIONAMIENTO_FALLIDO` | 500 | No se pudo provisionar la organización. No se creó ningún dato. | Fallo en un paso del provisionamiento; transacción revertida |
| `ORGANIZACION_VERTICAL_NO_MODIFICABLE` | 422 | El vertical no se puede cambiar porque la organización ya fue provisionada. | Intento de cambiar `verticalId` tras el alta |
| `ORGANIZACION_YA_TIENE_ADMINISTRADOR` | 409 | Esta organización ya tiene un administrador. | Crear usuario inicial cuando ya existe un admin activo |
| `CONTEXTO_PLATAFORMA_REQUERIDO` | 403 | Esta operación requiere el ámbito de plataforma. | Usuario de organización invoca un endpoint de plataforma |

---

## Usuario (`USUARIO_*`)

| Código | HTTP | Mensaje al usuario | Cuando ocurre |
|--------|------|--------------------|---------------|
| `USUARIO_NO_ENCONTRADO` | 404 | No se encontró el usuario indicado. | Id inexistente o de otra organización |
| `USUARIO_EMAIL_DUPLICADO` | 409 | Ya existe un usuario con ese correo. | Unicidad global de email |
| `USUARIO_SIN_PERFIL` | 422 | El usuario debe tener al menos un perfil. | La operación lo dejaría sin perfiles |
| `USUARIO_SIN_SUCURSAL` | 422 | El usuario debe tener al menos una sucursal. | Usuario de organización sin sucursales |
| `USUARIO_PERFIL_AMBITO_INCOMPATIBLE` | 422 | El perfil no corresponde al ámbito del usuario. | Asignar perfil `PLATAFORMA` a usuario de organización o viceversa |
| `USUARIO_AUTOGESTION_PERFILES_PROHIBIDA` | 422 | No puede modificar sus propios perfiles. | Un usuario intenta cambiarse los perfiles a sí mismo |
| `USUARIO_AUTOINACTIVACION_PROHIBIDA` | 422 | No puede inactivarse a sí mismo. | Intento de autoinactivación |
| `USUARIO_ULTIMO_ADMINISTRADOR` | 422 | No se puede quitar el último administrador activo de la organización. | Inactivar o retirar el perfil dejaría la organización sin administrador |
| `USUARIO_YA_INACTIVO` | 422 | El usuario ya está inactivo. | Inactivar un usuario que ya lo está |
| `USUARIO_ORGANIZACION_INACTIVA` | 403 | La organización del usuario no está activa. | Login o operación bloqueada por organización inactiva (cuando se distingue del caso genérico de credenciales) |

---

## Catálogo — items (`ITEM_*`)

| Código | HTTP | Mensaje al usuario | Cuando ocurre |
|--------|------|--------------------|---------------|
| `ITEM_NO_ENCONTRADO` | 404 | No se encontró el item indicado. | Id inexistente o de otra organización |
| `ITEM_SKU_DUPLICADO` | 409 | Ya existe un item con ese SKU en la organización. | Unicidad parcial de SKU (incluye inactivos) |
| `ITEM_YA_INACTIVO` | 422 | El item ya está inactivo. | Inactivar un item que ya lo está |
| `ITEM_INACTIVO_NO_COTIZABLE` | 422 | Un item inactivo no se puede agregar a la cotización. | Intento de usar un item inactivo en un borrador nuevo |
| `ITEM_SERVICIO_NO_ADMITE_STOCK` | 422 | Un servicio no admite control de stock. | `SERVICIO` con `controlaStock` o stock informado |
| `ITEM_SERIALIZADO_STOCK_INVALIDO` | 422 | Un item serializado solo admite stock 0 o 1. | Stock aproximado mayor que uno |
| `ITEM_STOCK_NEGATIVO` | 400 | El stock aproximado no puede ser negativo. | Valor menor que cero |
| `ITEM_ATRIBUTO_DESCONOCIDO` | 400 | Hay un atributo que no está definido en la organización. | Clave de `atributos` sin definición activa |
| `ITEM_ATRIBUTO_REQUERIDO_AUSENTE` | 400 | Falta un atributo obligatorio. | Definición con `requerido` sin valor |
| `ITEM_ATRIBUTO_TIPO_INVALIDO` | 400 | El valor del atributo no corresponde al tipo definido. | Tipo de dato incorrecto |
| `ITEM_ATRIBUTO_OPCION_INVALIDA` | 400 | El valor no está entre las opciones permitidas. | Valor de `LISTA` fuera de `opciones` |
| `ITEM_ATRIBUTO_RANGO_INVALIDO` | 400 | El rango de años del atributo no es válido. | `RANGO_ANIO` mal formado o incoherente |
| `ITEM_ATRIBUTOS_LIMITE_EXCEDIDO` | 422 | El item supera el máximo de atributos permitidos. | Más de 40 claves en `atributos` |
| `ITEM_BUSQUEDA_CONSULTA_MUY_CORTA` | 400 | Escriba al menos dos caracteres para buscar. | Texto normalizado de búsqueda con menos de 2 caracteres |
| `ITEM_REGENERACION_MASIVA_REQUERIDA` | 422 | El cambio afecta demasiados items; ejecute la reindexación del catálogo. | Regeneración sincrónica sobrepasa el límite |

---

## Catálogo — alias (`ALIAS_*`)

| Código | HTTP | Mensaje al usuario | Cuando ocurre |
|--------|------|--------------------|---------------|
| `ALIAS_NO_ENCONTRADO` | 404 | No se encontró el alias indicado. | Alias inexistente o de otro item/organización |
| `ALIAS_DUPLICADO` | 409 | Ese alias ya existe en este item. | Mismo `normalizado` activo en el item |
| `ALIAS_MUY_CORTO` | 400 | El alias es demasiado corto. | Menos de 2 caracteres tras normalizar |
| `ALIAS_LIMITE_EXCEDIDO` | 422 | El item alcanzó el máximo de alias activos. | Más de 50 alias activos |
| `ALIAS_APRENDIDO_SIN_CONFIRMACION` | 422 | Confirme de forma explícita para guardar el alias aprendido. | Intento de crear `APRENDIDO` sin confirmación del operador |

---

## Catálogo — maestras (`MAESTRA_*`, `CATEGORIA_*`, `DEFINICION_ATRIBUTO_*`)

| Código | HTTP | Mensaje al usuario | Cuando ocurre |
|--------|------|--------------------|---------------|
| `MAESTRA_NO_ENCONTRADA` | 404 | No se encontró el registro de catálogo indicado. | Marca, unidad u otra maestra genérica ausente o ajena |
| `MAESTRA_INACTIVA` | 422 | El registro de catálogo está inactivo y no se puede asignar. | Asignar marca/unidad inactiva a un item |
| `MAESTRA_NOMBRE_DUPLICADO` | 409 | Ya existe un registro con ese nombre en la organización. | Unicidad de nombre en marcas u otras maestras |
| `MAESTRA_CODIGO_DUPLICADO` | 409 | Ya existe un registro con ese código en la organización. | Unicidad de código (unidades, etc.) |
| `CATEGORIA_NO_ENCONTRADA` | 404 | No se encontró la categoría indicada. | Id inexistente o de otra organización |
| `CATEGORIA_INACTIVA` | 422 | La categoría está inactiva y no se puede asignar. | Asignar categoría inactiva a un item |
| `CATEGORIA_NOMBRE_DUPLICADO` | 409 | Ya existe una categoría con ese nombre en el mismo nivel. | Unicidad (`organizacionId`, padre, nombre) |
| `CATEGORIA_PADRE_INVALIDO` | 422 | La categoría padre no es válida. | Padre inexistente, inactivo, de otra org. o más de un nivel |
| `DEFINICION_ATRIBUTO_NO_ENCONTRADA` | 404 | No se encontró la definición de atributo indicada. | Id inexistente o de otra organización |
| `DEFINICION_ATRIBUTO_CODIGO_DUPLICADO` | 409 | Ya existe una definición con ese código. | Unicidad (`organizacionId`, `codigo`) |
| `DEFINICION_ATRIBUTO_EN_USO` | 422 | No se puede inactivar: hay items que usan esta definición como requerida. | Inactivación que rompería invariantes vigentes |
| `DEFINICION_ATRIBUTO_OPCIONES_INVALIDAS` | 400 | Las opciones de la lista no son válidas. | Definición `LISTA` sin opciones útiles |

Códigos adicionales de aplicaciones y términos (mismo módulo de catálogo):

| Código | HTTP | Mensaje al usuario | Cuando ocurre |
|--------|------|--------------------|---------------|
| `APLICACION_NO_ENCONTRADA` | 404 | No se encontró la aplicación indicada. | Compatibilidad inexistente o ajena |
| `APLICACION_DATOS_INVALIDOS` | 400 | Los datos de la aplicación no son válidos. | Objeto vacío, no plano o con más de 20 claves |
| `APLICACION_DUPLICADA` | 409 | Ya existe una aplicación equivalente en este item. | Mismo `textoNormalizado` activo |
| `APLICACION_RANGO_EXCESIVO` | 422 | El rango de años no puede superar 60 años. | Rango demasiado amplio |
| `TERMINO_NO_ENCONTRADO` | 404 | No se encontró el término no resuelto. | Id inexistente o de otra organización |
| `TERMINO_YA_CERRADO` | 422 | El término ya fue cerrado. | Cerrar un término inactivo |

---

## Importación (`IMPORTACION_*`)

| Código | HTTP | Mensaje al usuario | Cuando ocurre |
|--------|------|--------------------|---------------|
| `IMPORTACION_NO_ENCONTRADA` | 404 | No se encontró la importación indicada. | Id inexistente o de otra organización |
| `IMPORTACION_ARCHIVO_INVALIDO` | 400 | El archivo no se pudo leer o no es un formato admitido. | CSV/Excel ilegible o extensión no soportada |
| `IMPORTACION_ARCHIVO_VACIO` | 400 | El archivo no contiene filas de datos. | Sin filas útiles tras el encabezado |
| `IMPORTACION_MAPEO_INVALIDO` | 400 | El mapeo de columnas es incompleto o incorrecto. | Columnas obligatorias sin mapear |
| `IMPORTACION_ESTADO_INVALIDO` | 422 | La importación no admite esta acción en su estado actual. | Validar/confirmar fuera de la secuencia `CARGADA` → `VALIDADA` → `CONFIRMADA` |
| `IMPORTACION_SIN_FILAS_VALIDAS` | 422 | No hay filas válidas para confirmar. | Tras validar, `filasValidas` es cero |
| `IMPORTACION_FILA_INVALIDA` | 400 | Una o más filas tienen errores de validación. | Detalle por fila en `details` / `erroresDetalle` |
| `IMPORTACION_YA_CONFIRMADA` | 422 | Esta importación ya fue confirmada. | Reintento de confirmación |
| `IMPORTACION_CANCELADA` | 422 | La importación está cancelada y no se puede continuar. | Operar sobre estado `CANCELADA` |

---

## Precios — listas (`LISTA_*`)

| Código | HTTP | Mensaje al usuario | Cuando ocurre |
|--------|------|--------------------|---------------|
| `LISTA_NO_ENCONTRADA` | 404 | No se encontró la lista de precios indicada. | Id inexistente o de otra organización |
| `LISTA_CODIGO_DUPLICADO` | 409 | Ya existe una lista con ese código. | Unicidad (`organizacionId`, `codigo`) |
| `LISTA_INACTIVA` | 422 | La lista de precios está inactiva. | Usar o asignar una lista inactiva |
| `LISTA_PREDETERMINADA_REQUERIDA` | 422 | La organización debe tener una lista de precios predeterminada. | Quitar la única predeterminada sin reemplazo |
| `LISTA_VIGENCIA_INVALIDA` | 400 | El rango de vigencia de la lista no es válido. | `vigenciaHasta` anterior a `vigenciaDesde` |
| `LISTA_MONEDA_INACTIVA` | 422 | La moneda de la lista no está activa. | Moneda inexistente o inactiva |
| `LISTA_MONEDA_DISTINTA_DE_BASE` | 422 | La moneda de la lista debe coincidir con la moneda base. | MVP: listas solo en moneda base |

---

## Precios — precio de item (`PRECIO_*`)

| Código | HTTP | Mensaje al usuario | Cuando ocurre |
|--------|------|--------------------|---------------|
| `PRECIO_NO_ENCONTRADO` | 404 | No se encontró el precio indicado. | Par lista/item inexistente o ajeno |
| `PRECIO_NEGATIVO` | 400 | El precio no puede ser negativo. | Valor menor que cero |
| `PRECIO_FORMATO_INVALIDO` | 400 | El precio debe ser una cantidad decimal válida. | Cadena no parseable como decimal |
| `PRECIO_ITEM_INACTIVO` | 422 | No se puede asignar precio a un item inactivo. | Item con `estadoRegistro` `INACTIVO` |
| `PRECIO_AUSENTE_EN_LISTA` | 422 | El item no tiene precio en la lista aplicada. | Línea no cotizable; bloquea aprobación |
| `PRECIO_INVALIDO` | 400 | El precio debe ser mayor que cero y con formato válido. | Precio ≤ 0 o mal formado |

---

## Precios — reglas de descuento (`REGLA_*`)

| Código | HTTP | Mensaje al usuario | Cuando ocurre |
|--------|------|--------------------|---------------|
| `REGLA_NO_ENCONTRADA` | 404 | No se encontró la regla de descuento indicada. | Id inexistente o de otra organización |
| `REGLA_AMBITO_INVALIDO` | 400 | El ámbito o la referencia de la regla no son válidos. | `referenciaId` incompatible con `ambito` |
| `REGLA_REFERENCIA_REQUERIDA` | 400 | Indique la referencia según el ámbito de la regla. | Ámbito no GLOBAL sin `referenciaId` |
| `REGLA_VALOR_INVALIDO` | 400 | El valor del descuento no es válido. | Porcentaje fuera de rango, monto negativo, etc. |
| `REGLA_VIGENCIA_INVALIDA` | 400 | El rango de vigencia de la regla no es válido. | Fechas incoherentes |
| `REGLA_CANTIDAD_INVALIDA` | 400 | El rango de cantidades de la regla no es válido. | Mínimo/máximo incoherentes |
| `REGLA_INACTIVA` | 422 | La regla de descuento está inactiva. | Intentar aplicar una regla inactiva de forma explícita |

---

## Precios — tasas de cambio (`TASA_*`)

| Código | HTTP | Mensaje al usuario | Cuando ocurre |
|--------|------|--------------------|---------------|
| `TASA_NO_ENCONTRADA` | 404 | No se encontró la tasa de cambio indicada. | Id o par de monedas inexistente en la organización |
| `TASA_VALOR_INVALIDO` | 400 | El valor de la tasa debe ser mayor que cero. | Valor no positivo o mal formado |
| `TASA_MONEDAS_IGUALES` | 400 | Las monedas de origen y destino deben ser distintas. | Mismo id en origen y destino |
| `TASA_DUPLICADA` | 409 | Ya existe una tasa para ese par de monedas en esa fecha. | Unicidad por org., monedas y `fechaVigencia` |
| `TASA_NO_DISPONIBLE` | 422 | No hay tasa vigente para convertir a la moneda de presentación. | Aprobar/mostrar sin tasa aplicable |

---

## Cliente (`CLIENTE_*`)

| Código | HTTP | Mensaje al usuario | Cuando ocurre |
|--------|------|--------------------|---------------|
| `CLIENTE_NO_ENCONTRADO` | 404 | No se encontró el cliente indicado. | Id inexistente o de otra organización |
| `CLIENTE_WHATSAPP_DUPLICADO` | 409 | Ya existe un cliente con ese número de WhatsApp. | Unicidad parcial de `telefonoWhatsapp` |
| `CLIENTE_YA_INACTIVO` | 422 | El cliente ya está inactivo. | Inactivar un cliente que ya lo está |
| `CLIENTE_LISTA_INACTIVA` | 422 | La lista de precios asignada al cliente no está activa. | Asignar lista inactiva |
| `CLIENTE_NOMBRE_REQUERIDO` | 400 | El nombre del cliente es obligatorio. | Nombre vacío tras validación |
| `WHATSAPP_FORMATO_INVALIDO` | 400 | El número de WhatsApp no tiene un formato válido. | No cumple E.164 tras normalizar |
| `WHATSAPP_SIN_CODIGO_PAIS` | 400 | Indique el número con código de país (por ejemplo +58…). | Dígitos locales sin `+` / código país |
| `CLIENTE_REUTILIZADO_POR_WHATSAPP` | — | Se usó el cliente existente con ese WhatsApp. | Advertencia en respuesta de alta ocasional (no es error HTTP) |

---

## Solicitud e interpretación (`SOLICITUD_*`, `IA_*`)

| Código | HTTP | Mensaje al usuario | Cuando ocurre |
|--------|------|--------------------|---------------|
| `SOLICITUD_NO_ENCONTRADA` | 404 | No se encontró la solicitud indicada. | Id inexistente o de otra organización |
| `SOLICITUD_TEXTO_VACIO` | 400 | El texto de la solicitud no puede estar vacío. | `textoOriginal` vacío o solo espacios |
| `SOLICITUD_TEXTO_DEMASIADO_LARGO` | 400 | El texto supera el máximo permitido. | Más de 4000 caracteres |
| `SOLICITUD_YA_INTERPRETADA` | 422 | La solicitud ya fue interpretada; use reprocesar si necesita otra pasada. | Conflicto de flujo cuando aplica |
| `IA_NO_DISPONIBLE` | 502 | El servicio de interpretación no está disponible. | Proveedor caído, timeout o error de red |
| `IA_RESPUESTA_INVALIDA` | 502 | La interpretación devolvió un resultado que no se puede usar. | Fallo del esquema estricto (p. ej. campos de importe) |
| `IA_DESHABILITADA` | 422 | La interpretación automática está deshabilitada en esta organización. | `usaIa` falso o proveedor `none` cuando se exige IA |
| `CATALOGO_VACIO` | 422 | La organización no tiene items activos para resolver el pedido. | Resolución sin catálogo cotizable |
| `RESOLUCION_SIN_CANDIDATOS` | 422 | No se encontraron candidatos en el catálogo para esa línea. | Cascada sin coincidencias por encima del umbral de descarte |

Nota: si la interpretación falla durante `POST /api/precotizaciones`, la API responde **201** con
`interpretacion.exito` en falso y borrador vacío (`docs/06-diseno-tecnico.md`). Los códigos `IA_*`
aplican a operaciones que sí fallan la petición (reproceso forzado, diagnóstico) o se registran en
la interpretación sin abortar el alta del borrador.

---

## Cotización (`COTIZACION_*`, `FOLIO_*`)

| Código | HTTP | Mensaje al usuario | Cuando ocurre |
|--------|------|--------------------|---------------|
| `COTIZACION_NO_ENCONTRADA` | 404 | No se encontró la cotización indicada. | Id inexistente o de otra organización |
| `COTIZACION_SIN_LINEAS` | 422 | No se puede aprobar una cotización sin líneas. | Aprobar borrador vacío |
| `COTIZACION_LINEA_NO_RESUELTA` | 422 | Hay líneas sin item o sin precio; resuélvalas antes de aprobar. | Línea `NO_ENCONTRADA` o sin precio en la lista |
| `COTIZACION_LINEA_NO_ENCONTRADA` | 404 | No se encontró la línea indicada. | Línea inexistente o de otra cotización/organización |
| `COTIZACION_NO_EDITABLE` | 422 | Solo se pueden editar cotizaciones en borrador. | Editar líneas fuera de `BORRADOR` |
| `COTIZACION_TRANSICION_INVALIDA` | 422 | Esa transición de estado no está permitida. | Fuera de la tabla del glosario |
| `COTIZACION_ANULACION_SIN_MOTIVO` | 400 | Indique un motivo de anulación de al menos diez caracteres. | Motivo ausente o demasiado corto |
| `COTIZACION_YA_ANULADA` | 422 | La cotización ya está anulada. | Reanular |
| `COTIZACION_VIGENCIA_VENCIDA` | 422 | La vigencia de la cotización expiró. | Operación incompatible con `VENCIDA` (salvo las permitidas) |
| `COTIZACION_PRECIO_SOBRESCRITURA_SIN_PERMISO` | 403 | No tiene permiso para sobrescribir el precio de una línea. | Falta `cotizaciones.sobrescribir_precio` |
| `COTIZACION_PRECIO_SOBRESCRITURA_SIN_MOTIVO` | 400 | Indique el motivo de la sobrescritura de precio. | Sobrescritura sin motivo |
| `COTIZACION_CANTIDAD_INVALIDA` | 400 | La cantidad de la línea no es válida. | Cantidad ≤ 0, o decimal cuando la unidad no lo permite |
| `COTIZACION_SERIALIZADO_CANTIDAD_INVALIDA` | 422 | Un item serializado solo admite cantidad 1. | Cantidad distinta de 1 en `SERIALIZADO` |
| `COTIZACION_ITEM_INACTIVO` | 422 | No se puede usar un item inactivo en el borrador. | Agregar item inactivo |
| `FOLIO_NO_DISPONIBLE` | 422 | No se pudo asignar el folio de la cotización. | Fallo al bloquear o incrementar `secuencias_folio` |
| `FOLIO_FORMATO_INVALIDO` | 422 | El formato de folio de la plantilla no es válido. | Plantilla con patrón de folio incorrecto |

---

## Plantillas y documentos (`PLANTILLA_*`, `PDF_*`, `DOCUMENTO_*`)

| Código | HTTP | Mensaje al usuario | Cuando ocurre |
|--------|------|--------------------|---------------|
| `PLANTILLA_NO_ENCONTRADA` | 404 | No se encontró la plantilla de documento indicada. | Id inexistente o de otra organización |
| `PLANTILLA_CONFIGURACION_INVALIDA` | 400 | La configuración de la plantilla no es válida. | Fallo del esquema Zod de plantilla |
| `PLANTILLA_INACTIVA` | 422 | La plantilla está inactiva. | Generar documento con plantilla inactiva |
| `PLANTILLA_PREDETERMINADA_REQUERIDA` | 422 | Debe existir una plantilla predeterminada. | Quitar la única predeterminada sin reemplazo |
| `PDF_GENERACION_FALLIDA` | 502 | No se pudo generar el PDF. Intente de nuevo. | Fallo del adaptador `GeneradorPdf` / Chromium |
| `PDF_TIMEOUT` | 502 | La generación del PDF agotó el tiempo de espera. | Superó `PDF_TIMEOUT_MS` |
| `DOCUMENTO_NO_DISPONIBLE` | 404 | El documento aún no está disponible. | Descarga antes de generar, archivo ausente en almacenamiento o hash no encontrado |
| `DOCUMENTO_COTIZACION_NO_APROBADA` | 422 | Solo se genera documento de cotizaciones aprobadas o posteriores. | Intento de PDF sobre `BORRADOR` |
| `DOCUMENTO_ALMACENAMIENTO_NO_DISPONIBLE` | 502 | No se pudo guardar o leer el archivo del documento. | Fallo del adaptador de almacenamiento |

---

## Cómo agregar un código nuevo

1. **Confirmar que no existe** un código equivalente en este documento (mismo significado, otro
   nombre). Preferir reutilizar el genérico (`RECURSO_NO_ENCONTRADO`, `OPERACION_NO_PERMITIDA_EN_ESTADO`)
   solo cuando el caso no aporte acción distinta al usuario.
2. **Elegir el prefijo del módulo** (`AUTH_`, `ITEM_`, `COTIZACION_`, etc.) y un sufijo en
   `UPPER_SNAKE_CASE` sin tildes.
3. **Asignar HTTP** según la tabla de convenciones de este documento y de
   `docs/06-diseno-tecnico.md`.
4. **Redactar el mensaje al usuario** en español con tildes, en una sola frase, sin jerga interna ni
   detalles de implementación.
5. **Registrar en tres sitios en la misma PR:**
   - Una fila en la tabla correspondiente de `docs/08-catalogo-errores.md`.
   - La constante / fábrica en `packages/shared/src/errors/`.
   - La especificación del módulo en `docs/specs/`, sección de errores funcionales.
6. **Lanzar desde el servicio** con la subclase adecuada de `AppError` (nunca un string suelto en el
   controlador).
7. **Cubrir con prueba** el camino que produce el código (al menos el caso feliz de rechazo).
8. Si el código es de aislamiento entre organizaciones, la prueba debe demostrar HTTP 404 y el código
   `*_NO_ENCONTRADO`, nunca 403.

## Documentos relacionados

- `docs/06-diseno-tecnico.md` — contrato de error y códigos HTTP.
- `docs/07-convenciones-implementacion.md` — `AppError`, filtro global y orden de servicios.
- `docs/10-convenciones-git-y-calidad.md` — checklist de PR.
- `docs/01-glosario.md` — estados de cotización y vocabulario.
- `decisions/0001-multi-tenancy-por-organizacion.md` — por qué el ajeno es 404.
