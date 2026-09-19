# Spec 007: Clientes

## Estado

En implementación (2026-09-18)

## Objetivo

Definir el alta, edicion, busqueda e inactivacion de clientes de una organizacion. El cliente es
quien pide una cotizacion por WhatsApp: se identifica preferentemente por su numero normalizado, tiene
asignada una lista de precios para no decidir el precio a mano en cada captura, y desde su ficha se
accede a sus cotizaciones recientes.

Una cotizacion puede emitirse sin cliente registrado (nombre libre). Esta spec cubre el maestro de
clientes, no la captura de la solicitud.

## Dependencias

| Documento | Que aporta |
|-----------|-----------|
| `docs/06-diseno-tecnico.md` | Tabla `clientes`, permisos `clientes.*`, indices |
| `docs/01-glosario.md` | Definicion de Cliente vs Organizacion vs Usuario |
| `docs/05-alcance-mvp.md` | Alta/edicion con WhatsApp, lista de precios, notas, ultimas cotizaciones |
| `docs/specs/006-listas-precios-reglas.md` | Listas asignables y lista predeterminada |
| `docs/specs/002-configuracion-organizacion.md` | Lista predeterminada de la organizacion |
| `docs/decisions/0001-multi-tenancy-por-organizacion.md` | Aislamiento |

## Alcance MVP v1

Incluye:

- Alta y edicion de clientes: nombre, WhatsApp, correo, identificacion fiscal, direccion, notas.
- Normalizacion del telefono de WhatsApp y unicidad parcial por organizacion.
- Asignacion de lista de precios (o uso de la predeterminada si es nula).
- Busqueda por nombre, WhatsApp e identificacion fiscal.
- Listado de recientes (ultima actividad / actualizacion).
- Cliente ocasional: alta rapida minima desde la captura (nombre + WhatsApp opcional).
- Inactivacion sin borrado fisico; cliente inactivo no se elige en capturas nuevas.
- Consulta de cotizaciones recientes del cliente desde su ficha (lectura).

No incluye en esta version:

| Fuera de alcance | Motivo |
|------------------|--------|
| Portal de autoservicio del cliente comprador | Fuera de alcance del MVP |
| Integracion WhatsApp Business API | Fase 3 |
| Fusion de clientes duplicados asistida | Diferida |
| Direcciones multiples o contactos multiples | Un solo bloque de datos en el MVP |
| Credito, cupo o condiciones comerciales complejas | Solo lista de precios y notas |
| Borrado fisico | Prohibido |

## Conceptos principales

| Concepto | Definicion operativa |
|----------|----------------------|
| Cliente | Persona o empresa que solicita cotizaciones; pertenece a una organizacion |
| Telefono WhatsApp | Numero normalizado E.164 sin signos; unico parcial por organizacion cuando no es nulo |
| Lista asignada | `listaPrecioId`; si es nulo, al cotizar se usa la predeterminada de la organizacion |
| Cliente ocasional | Cliente creado con datos minimos en el flujo de captura, reutilizable despues |
| Recientes | Clientes ordenados por `updatedAt` o por fecha de ultima cotizacion |
| Nombre libre | Texto en la cotizacion sin `clienteId`; no crea fila en `clientes` automaticamente |

## Datos requeridos

### Tabla `clientes`

| Campo | Obligatorio | Notas |
|-------|-------------|-------|
| `id` | Si | `uuid` |
| `organizacionId` | Si | Del `OrgContext`, nunca de la entrada |
| `nombre` | Si | 2 a 160 caracteres |
| `telefonoWhatsapp` | No | Normalizado. Unico parcial (`organizacionId`, `telefonoWhatsapp`) cuando no es nulo |
| `email` | No | Formato de correo valido |
| `identificacionFiscal` | No | Texto 3 a 40 caracteres. No hay unicidad global en el MVP |
| `listaPrecioId` | No | Lista activa de la organizacion; nulo = usar predeterminada al cotizar |
| `direccion` | No | Hasta 300 caracteres |
| `notas` | No | Hasta 2000 caracteres; solo uso interno |
| `estadoRegistro` | Si | `ACTIVO` al crear; `INACTIVO` al inactivar |
| `createdAt`, `updatedAt`, `createdById`, `updatedById` | Si | Auditoria estandar |

Indices relevantes: unico parcial por WhatsApp; listados por (`organizacionId`, `estadoRegistro`);
las cotizaciones del cliente se consultan via `cotizaciones.clienteId` con indice
(`organizacionId`, `clienteId`).

### Normalizacion de WhatsApp

| Paso | Transformacion |
|------|----------------|
| 1 | Recortar espacios |
| 2 | Eliminar espacios, guiones, parentesis y puntos |
| 3 | Si comienza con `00`, reemplazar por `+` |
| 4 | Si no tiene `+` y es solo digitos, anteponer `+` solo cuando el pais esta configurado; en MVP se exige codigo de pais con `+` o se asume el codigo por defecto de la organizacion si se declara en preguntas abiertas |
| 5 | Validar forma E.164: `+` seguido de 8 a 15 digitos |
| 6 | Persistir el valor normalizado; la interfaz puede mostrar formato local |

Decision MVP v1 operativa: el valor almacenado debe coincidir con el patron `^\+[1-9]\d{7,14}$`.
Entradas como `0414-1234567` sin codigo de pais se rechazan con `WHATSAPP_SIN_CODIGO_PAIS` salvo que
la organizacion tenga un codigo pais por defecto (pregunta abierta). Hasta resolverlo, la interfaz
guia a ingresar con `+58...`.

## Reglas de negocio

### Alcance y aislamiento

1. Toda operacion exige `ctx.organizacionId` no nulo.
2. Identificador de cliente ajeno: 404 `CLIENTE_NO_ENCONTRADO`.
3. Usuario de ambito plataforma: error de contexto.

### Alta y edicion

4. `nombre` es obligatorio en toda alta, incluida la ocasional.
5. `telefonoWhatsapp`, si se informa, se normaliza antes de validar unicidad.
6. Dos clientes activos o inactivos de la misma organizacion no pueden compartir el mismo WhatsApp
   normalizado. Conflicto 409 `CLIENTE_WHATSAPP_DUPLICADO` sin revelar datos sensibles demas.
7. WhatsApp nulo se permite (cliente sin telefono). Varios clientes pueden tener WhatsApp nulo.
8. `listaPrecioId`, si se informa, debe ser una lista activa de la organizacion. Ajena: 404. Inactiva:
   422 `LISTA_PRECIO_INACTIVA`.
9. Cambiar la lista del cliente no modifica cotizaciones ya creadas; solo afecta capturas futuras.
10. `email` mal formado: 400.
11. Las `notas` nunca se incluyen en el PDF ni en el texto para WhatsApp.
12. El nombre no requiere ser unico.

### Cliente ocasional

13. Desde la captura de precotizacion se puede crear un cliente con solo `nombre` y opcionalmente
    `telefonoWhatsapp` y `listaPrecioId`, usando `POST /api/clientes` con los mismos permisos.
14. Si al capturar se informa un WhatsApp que ya existe, no se crea duplicado: se reutiliza el cliente
    existente (respuesta de alta ocasional puede ser el existente con advertencia
    `CLIENTE_REUTILIZADO_POR_WHATSAPP`).
15. Usar solo `nombreClienteLibre` / `telefonoClienteLibre` en la precotizacion **no** crea fila en
    `clientes`.

### Busqueda y listado

16. `GET /api/clientes` admite `search` sobre nombre, WhatsApp e identificacion fiscal (parcial,
    case-insensitive, WhatsApp comparando normalizado).
17. Filtro `estadoRegistro` por defecto `ACTIVO`.
18. Orden por defecto: `updatedAt` descendente (recientes primero). Parametro `orden=recientes` o
    `orden=nombre`.
19. Paginacion estandar `page`, `limit`.
20. El selector de captura usa la misma busqueda con `limit` bajo (por ejemplo 20) y solo activos.

### Cotizaciones recientes en la ficha

21. La ficha del cliente incluye las ultimas N cotizaciones (N=10 en MVP) de esa organizacion y
    cliente, ordenadas por `createdAt` descendente, via consulta al modulo de cotizaciones con
    permiso `cotizaciones.ver` o embebiendo en `GET /api/clientes/:id` solo si el usuario tiene ese
    permiso; si no, la seccion no se muestra.
22. No se listan cotizaciones de otras organizaciones.

### Inactivacion

23. No hay borrado fisico. `PATCH` con `estadoRegistro: INACTIVO`.
24. Cliente inactivo no aparece en selectores de captura ni en busqueda por defecto.
25. Las cotizaciones historicas conservan el `clienteId` y siguen siendo legibles.
26. Un borrador existente puede conservar el cliente inactivado; al aprobar no se exige que el
    cliente este activo (el documento ya tiene nombre). Pregunta abierta: ¿bloquear aprobacion?
    Decision MVP: **no bloquear**.
27. Reactivar esta permitido y vuelve a validar unicidad del WhatsApp.
28. Inactivar un cliente ya inactivo: 422 `CLIENTE_YA_INACTIVO`.

### Lista de precios al cotizar

29. Al crear una precotizacion: si hay `clienteId` con `listaPrecioId`, se usa esa lista; si el
    cliente no tiene lista, la predeterminada de la organizacion; si la peticion trae `listaPrecioId`
    explicito, este tiene prioridad sobre la del cliente.
30. Detalle de resolucion de lista en `docs/specs/008-precotizacion-ia.md`.

## Permisos

| Permiso | Uso |
|---------|-----|
| `clientes.ver` | Listar, buscar y ver ficha |
| `clientes.crear` | Alta y alta ocasional |
| `clientes.editar` | Edicion, inactivacion y reactivacion |

El perfil `Cotizador` tiene `clientes.*`. El administrador tambien.

`docs/06-diseno-tecnico.md` no lista rutas de clientes en la tabla de endpoints; esta spec las
introduce siguiendo sus convenciones.

## API esperada

| Metodo | Ruta | Permiso | Uso |
|--------|------|---------|-----|
| GET | `/api/clientes` | `clientes.ver` | Listado, busqueda y recientes |
| POST | `/api/clientes` | `clientes.crear` | Alta / ocasional |
| GET | `/api/clientes/:id` | `clientes.ver` | Ficha |
| PATCH | `/api/clientes/:id` | `clientes.editar` | Edicion e inactivacion |

Ruta adicional opcional:

| Metodo | Ruta | Permiso | Uso |
|--------|------|---------|-----|
| GET | `/api/clientes/:id/cotizaciones` | `cotizaciones.ver` | Ultimas cotizaciones del cliente |

```typescript
// POST /api/clientes
type CrearClienteInput = {
  nombre: string;
  telefonoWhatsapp?: string | null;
  email?: string | null;
  identificacionFiscal?: string | null;
  listaPrecioId?: string | null;
  direccion?: string | null;
  notas?: string | null;
  ocasional?: boolean;  // marca UX; mismas reglas de validacion
};

// PATCH /api/clientes/:id
type EditarClienteInput = {
  nombre?: string;
  telefonoWhatsapp?: string | null;
  email?: string | null;
  identificacionFiscal?: string | null;
  listaPrecioId?: string | null;
  direccion?: string | null;
  notas?: string | null;
  estadoRegistro?: 'ACTIVO' | 'INACTIVO';
};

type ClienteDetalle = {
  id: string;
  nombre: string;
  telefonoWhatsapp: string | null;
  email: string | null;
  identificacionFiscal: string | null;
  listaPrecio: { id: string; codigo: string; nombre: string } | null;
  direccion: string | null;
  notas: string | null;
  estadoRegistro: 'ACTIVO' | 'INACTIVO';
  updatedAt: string;
  advertencias?: string[];
};
```

## Errores funcionales

| Codigo | Cuando ocurre |
|--------|---------------|
| `CLIENTE_NO_ENCONTRADO` | Id inexistente o de otra organizacion |
| `CLIENTE_WHATSAPP_DUPLICADO` | WhatsApp normalizado ya usado en la organizacion |
| `WHATSAPP_FORMATO_INVALIDO` | No cumple E.164 tras normalizar |
| `WHATSAPP_SIN_CODIGO_PAIS` | Digitos locales sin codigo de pais |
| `LISTA_PRECIO_INACTIVA` | Lista asignada inactiva |
| `LISTA_PRECIO_NO_ENCONTRADA` | Lista ajena o inexistente |
| `CLIENTE_YA_INACTIVO` | Inactivacion repetida |
| `VALIDACION_ENTRADA_INVALIDA` | Nombre corto, email mal formado, etc. |
| `PERMISO_DENEGADO` | Sin permiso |
| `CONTEXTO_ORGANIZACION_REQUERIDO` | Ambito plataforma |

## Experiencia de usuario

Rutas bajo `/clientes`: listado con buscador, filtro de estado, orden recientes/nombre; alta; ficha
con datos, lista de precios, notas y tabla de cotizaciones recientes.

En la captura de precotizacion, el selector de cliente busca en vivo y ofrece "Crear cliente" con
formulario corto (nombre, WhatsApp, lista). Si el WhatsApp ya existe, se selecciona el existente y se
muestra aviso.

Cliente inactivo: no sale en el selector; en el listado de administracion aparece atenuado con accion
de reactivar.

### Mensajes

| Situacion | Mensaje |
|-----------|---------|
| Alta correcta | Cliente creado |
| WhatsApp duplicado | Ya existe un cliente con ese WhatsApp |
| Reutilizado | Se uso el cliente existente con ese WhatsApp |
| Inactivado | Cliente inactivado. No aparecera en capturas nuevas |
| Sin lista | Se usara la lista de precios predeterminada |

## Criterios de aceptacion

### Alta y edicion

#### CA-001: Alta completa

Dado un usuario con `clientes.crear`, cuando crea un cliente con nombre, WhatsApp `+584141234567`,
lista activa y notas, entonces la respuesta es 201, el WhatsApp queda normalizado y
`organizacionId` es del contexto.

#### CA-002: Alta minima ocasional

Dado un alta solo con `nombre` `"Juan Perez"` y `ocasional: true`, cuando se envia, entonces se crea
activo sin WhatsApp ni lista, y al cotizar usara la lista predeterminada.

#### CA-003: WhatsApp duplicado

Dado un cliente con WhatsApp `+584141234567`, cuando se intenta crear otro con `+58 414 1234567`,
entonces tras normalizar la respuesta es 409 con `CLIENTE_WHATSAPP_DUPLICADO`.

#### CA-004: WhatsApp formato invalido

Dado el valor `abc`, cuando se crea, entonces 400 con `WHATSAPP_FORMATO_INVALIDO`.

#### CA-005: Lista ajena

Dado un `listaPrecioId` de otra organizacion, cuando se asigna, entonces 404.

#### CA-006: Edicion de lista no altera cotizaciones

Dada una cotizacion existente del cliente con lista A, cuando se cambia el cliente a lista B, entonces
la cotizacion conserva lista A.

### Busqueda y recientes

#### CA-007: Busqueda por nombre y WhatsApp

Dados clientes `"Maria Lopez"` con `+584121111111` y `"Pedro"`, cuando se busca `maria` o
`4121111111`, entonces el primero aparece en los resultados.

#### CA-008: Recientes primero

Dados tres clientes actualizados en orden distinto, cuando se lista con orden recientes, entonces el
mas recientemente actualizado es el primero.

#### CA-009: Solo activos por defecto

Dado un cliente inactivo, cuando se lista sin filtro de estado, entonces no aparece; con
`estadoRegistro=INACTIVO` si aparece.

### Ocasional y reutilizacion

#### CA-010: Reutilizar por WhatsApp en alta ocasional

Dado un cliente existente con WhatsApp `+584141234567`, cuando un cotizador intenta crear otro
ocasional con el mismo WhatsApp, entonces no se duplica: se devuelve el existente con advertencia
`CLIENTE_REUTILIZADO_POR_WHATSAPP` (200 o 201 segun implementacion documentada en cierre).

#### CA-011: Nombre libre no crea cliente

Dada una precotizacion solo con `nombreClienteLibre`, cuando se completa, entonces no existe fila
nueva en `clientes`.

### Inactivacion

#### CA-012: Inactivar quita del selector

Dado un cliente activo, cuando se inactiva, entonces deja de aparecer en la busqueda por defecto y
en el selector de captura, y sus cotizaciones historicas siguen legibles con su nombre.

#### CA-013: Reactivar valida WhatsApp

Dado un cliente inactivo cuyo WhatsApp ahora lo usa otro activo, cuando se intenta reactivar, entonces
409 con `CLIENTE_WHATSAPP_DUPLICADO`.

### Ficha y permisos

#### CA-014: Cotizaciones recientes en ficha

Dado un cliente con 15 cotizaciones, cuando se consulta su ficha o
`GET /api/clientes/:id/cotizaciones` con `cotizaciones.ver`, entonces se reciben las 10 mas recientes
de su organizacion.

#### CA-015: Sin permiso de cotizaciones

Dado un usuario con `clientes.ver` pero sin `cotizaciones.ver`, cuando abre la ficha, entonces ve
datos del cliente y no el listado de cotizaciones (o la subruta responde 403).

### Aislamiento

#### CA-016: Aislamiento entre organizaciones

Dado un usuario de la organizacion A y un cliente de B, cuando intenta GET o PATCH por id, entonces
404 con `CLIENTE_NO_ENCONTRADO` y el cliente de B no cambia.

#### CA-017: Busqueda no cruza organizaciones

Dados homónimos en A y B, cuando un usuario de A busca ese nombre, entonces solo obtiene el de A.

## Verificacion requerida para cierre

- [ ] Normalizacion de WhatsApp con casos de espacios, guiones y `+`.
- [ ] Unicidad parcial: duplicado con telefono, multiples nulos permitidos.
- [ ] ABM con lista activa/inactiva/ajena.
- [ ] Busqueda por nombre, telefono e identificacion; orden recientes.
- [ ] Inactivacion y reactivacion; exclusion del selector.
- [ ] Reutilizacion por WhatsApp en alta ocasional.
- [ ] Nombre libre no crea cliente.
- [ ] Cotizaciones recientes limitadas a 10 y filtradas por organizacion.
- [ ] **Aislamiento entre organizaciones** en listado, busqueda, detalle y edicion.
- [ ] Permisos `clientes.ver|crear|editar` respetados; cotizaciones recientes exigen
      `cotizaciones.ver`.

## Preguntas abiertas

1. Codigo de pais por defecto por organizacion para aceptar numeros locales sin `+`.
2. ¿Bloquear aprobacion si el cliente fue inactivado despues de crear el borrador? MVP: no.
3. ¿Unicidad de `identificacionFiscal` dentro de la organizacion?
4. Respuesta HTTP exacta al reutilizar cliente por WhatsApp (200 vs 201).
5. ¿El orden "recientes" debe basarse en ultima cotizacion en lugar de `updatedAt`?

## Decisiones MVP v1

| Decision | Motivo |
|----------|--------|
| WhatsApp unico parcial por organizacion | Evita duplicar el mismo chat como dos fichas |
| Lista nula usa la predeterminada al cotizar | Menos friccion en el alta ocasional |
| Nombre libre no crea cliente | Evita contaminar el maestro con textos de una sola vez |
| Reutilizar por WhatsApp en ocasional | Evita 409 en el mostrador cuando el cliente ya existe |
| Inactivar no borra ni altera historial | Regla de no borrado fisico |
| Notas solo internas | No deben salir en el documento al cliente |
| Rutas `/api/clientes` introducidas aqui | El diseño tecnico define la tabla y permisos; faltaban endpoints |
| Nomenclatura Cliente / Organizacion | Glosario: nunca llamar "cliente" a la organizacion |
