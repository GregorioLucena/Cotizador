# Guia UX/UI

Guía de interfaz del MVP v1 para `apps/web`. Define principios de producto, sistema visual,
navegación, patrones de pantallas y formato de datos. No sustituye las especificaciones por módulo:
cuando una spec refine una pantalla, prevalece la spec.

## Referencias

| Documento | Aporta |
|-----------|--------|
| `docs/00-vision.md` | Regla de oro y actores |
| `docs/01-glosario.md` | Semaforo de resolucion y nomenclatura |
| `docs/05-alcance-mvp.md` | Objetivo de menos de un minuto en mostrador |
| `docs/06-diseno-tecnico.md` | Permisos, estados, importes como cadena |
| `docs/11-arquitectura-monorepo.md` | Route groups `(auth)` / `(app)` y estructura de componentes |
| `docs/decisions/0009-stack-tecnologico.md` | Next.js App Router, Tailwind v4, lucide-react |
| `docs/04-flujo-precotizacion.md` | Semaforo y degradacion del pipeline |

## Nomenclatura en interfaz

| Usar | No usar |
|------|---------|
| Organizacion | tenant, empresa, cliente (para el negocio) |
| Cliente | comprador, contacto (solo quien pide cotizacion) |
| Item | producto |
| Cotizacion / borrador | precotizacion en textos visibles (termino interno OK en docs) |

Ningún texto de interfaz puede sugerir que un importe lo “calculó” o “propuso” la IA. La IA
interpreta el pedido; el catálogo cotiza.

---

## Principios

### Mobile-first a 375px

El caso de uso principal es el mostrador: teléfono o tablet estrecha. El diseño base es
**375px de ancho**. Escritorio amplía, no redefine el flujo.

| Regla | Detalle |
|-------|---------|
| Ancho de referencia | 375px; tipografia y areas tactiles evaluadas ahi primero |
| Areas tactiles | Minimo 44px de alto en botones y filas accionables |
| Una columna | Formularios y revision en columna unica en movil |
| Densidad en escritorio | Tablas y paneles lado a lado solo desde breakpoint `md` |

### Cotizar en una pantalla

La acción crítica —pegar mensaje, ver borrador, corregir y aprobar— debe caber en el recorrido
mental de **una sola tarea**. No fragmentar en asistentes de muchos pasos.

| Debe | No debe |
|------|---------|
| Captura + resultado visibles sin perder contexto | Asistente de 5 pantallas para una cotizacion |
| Semaforo y totales siempre a la vista al revisar | Esconder el total detras de un modal |
| Aprobar con un gesto explicito y visible | Enter accidental que apruebe |

### Confirmacion destructiva

Toda acción irreversible o de alto impacto exige confirmación explícita con consecuencia clara.

| Accion | Confirmacion |
|--------|--------------|
| Anular cotizacion | Dialogo con motivo obligatorio (>= 10 caracteres) |
| Inactivar item | Confirmacion; el item deja de ser cotizable |
| Eliminar linea del borrador | Confirmacion breve si la linea ya tenia item |
| Marcar perdida | Motivo obligatorio |
| Restablecer clave de usuario | Confirmacion |

Las acciones reversibles (editar cantidad, elegir candidato) no abren diálogo.

### Nada sin aprobacion humana

Ninguna cotización se entrega al cliente sin aprobación registrada (`aprobadaPorId`, `aprobadaAt`).
La interfaz:

1. Distingue visualmente `BORRADOR` de estados posteriores.
2. Deshabilita “copiar para WhatsApp” y “generar PDF” hasta `APROBADA` (o los ofrece solo como
   previsualización interna si la spec lo permite; la entrega al cliente es post-aprobación).
3. Nunca envía ni marca `ENVIADA` en silencio.

---

## Sistema visual

### Tailwind CSS v4 y tokens

Estilos con Tailwind CSS ^4.1.13. Los tokens se declaran con `@theme inline` en
`apps/web/src/app/globals.css`. No hay archivo de configuración JavaScript de Tailwind.

```css
/* Ejemplo de forma — valores concretos en implementacion */
@theme inline {
  --color-fondo: ...;
  --color-superficie: ...;
  --color-texto: ...;
  --color-texto-secundario: ...;
  --color-borde: ...;
  --color-acento: ...;
  --color-exito: ...;
  --color-advertencia: ...;
  --color-peligro: ...;
  --font-sans: ...;
  --radius-ui: ...;
}
```

| Regla | Detalle |
|-------|---------|
| Tokens semanticos | Preferir `--color-exito` sobre verdes crudos en componentes de dominio |
| Componentes base | `components/ui/` con variantes via clases y `cn()` (clsx + tailwind-merge) |
| Iconos | Solo `lucide-react`, un icono por import |
| Sin logica de negocio en UI | Recalculo de importes con `@cotizador/shared`, no formulas locales |

Dirección visual: **luz de taller** — hero de marca en teal profundo, papel frío y ámbar solo
en CTAs. Tipografía display geométrica (Outfit) + cuerpo legible. Landing pública: una composición
a pantalla completa (marca hero + una tesis + una CTA + demo chat→ticket). El producto interno
prioriza claridad táctil a 375px (mobile-first). Evitar temas púrpura genéricos, fondos crema con
serif ornamental, negro+acento ácido, o estética “dashboard SaaS” saturada de tarjetas. Las
tarjetas se usan solo cuando contienen una interacción o un bloque de estado (p. ej. resumen del
semáforo), no como decoración.

### Semaforo de resolucion

Cada línea del borrador muestra estado con **icono + texto + color**. El color nunca es el único
canal (accesibilidad).

| `estadoResolucion` | Semaforo | Color token | Icono (lucide) | Texto visible |
|--------------------|----------|-------------|----------------|---------------|
| `RESUELTA_AUTOMATICA` | Verde | `--color-exito` | `CircleCheck` | Resuelta |
| `RESUELTA_MANUAL` | Verde | `--color-exito` | `UserCheck` | Corregida |
| `AGREGADA_MANUAL` | Verde | `--color-exito` | `Plus` | Agregada |
| `SUGERIDA_REVISAR` | Ambar | `--color-advertencia` | `CircleAlert` | Revisar |
| `NO_ENCONTRADA` | Rojo | `--color-peligro` | `CircleX` | Sin match |

El resumen del borrador agrega contadores: resueltas / a revisar / sin match. Los umbrales
(`umbralAutomatico`, `umbralDescarte`) no se explican en jerga técnica al cotizador; el semáforo
basta. El administrador los ve en configuración.

---

## Navegacion

### Route groups

| Grupo | Rutas | Cascaron |
|-------|-------|----------|
| `(auth)` | Login, cambio de clave forzado | Sin barra de navegacion de la app |
| `(app)` | Area autenticada | `AppShell`: cabecera + menú lateral (base) |

Usuarios de ámbito `PLATAFORMA` ven el área `plataforma/` para organizaciones; **no** operan
cotizaciones de una organización ajena.

### Navegación base (obligatoria)

Patrón canónico del área autenticada. **No sustituir** por dock inferior, tabs fijos ni
sidebar permanente sin decisión explícita en esta guía.

| Pieza | Comportamiento |
|-------|----------------|
| Cascarón | `AppShell` en `apps/web/src/components/shell/app-shell.tsx` |
| Cabecera | Fija, marca Cotizador a la izquierda, botón **Menú** a la derecha |
| Menú | Panel lateral derecho deslizante (overlay + Escape / tap fuera para cerrar) |
| Destinos | Filas grandes (icono + título + descripción); activo resaltado en teal |
| Cerrar sesión | Siempre al pie del menú lateral |
| Mobile-first | Áreas táctiles ≥ 44px; el menú ocupa hasta ~22rem de ancho |

Destinos nuevos (Cotizar, Historial, Catálogo, etc.) se **agregan como filas** en el mismo menú,
filtradas por permiso del `OrgContext`. No se introduce otra barra de navegación paralela.

| Destino | Ruta orientativa | Permiso minimo tipico |
|---------|------------------|------------------------|
| Inicio | `/panel` | autenticado |
| Cotizar | `/cotizaciones/nueva` (o equivalente) | `cotizaciones.crear` |
| Historial | `/cotizaciones` | `cotizaciones.ver` |
| Catalogo | `/catalogo` | `catalogo.items.ver` |
| Configuracion | `/configuracion` | `configuracion.organizacion.ver` |
| Organizaciones | `/plataforma/organizaciones` | ambito `PLATAFORMA` |

En escritorio se conserva el mismo patrón (cabecera + menú lateral); no hay variante distinta
obligatoria.

### Enlaces secundarios (ex-hub «Mas»)

Los enlaces de administración que no son destinos primarios viven **dentro del menú lateral**
(sección inferior o agrupados bajo Configuración), filtrados por permiso. Si el usuario no tiene
el permiso, el enlace **no se muestra**.

| Enlace | Permiso orientativo |
|--------|---------------------|
| Clientes | `clientes.ver` |
| Precios y listas | `precios.listas.ver` |
| Reglas de descuento | `precios.reglas.administrar` |
| Tasas de cambio | `precios.tasas.administrar` |
| Importacion | `catalogo.items.importar` |
| Metricas | `reportes.ver` |
| Usuarios | `seguridad.usuarios.ver` |
| Plantilla de documento | `plantillas.ver` |
| Terminos no resueltos | `catalogo.items.ver` |
| Cerrar sesion | autenticado (pie del menú) |

El perfil `Cotizador` ve un menú corto (destinos operativos + pocos secundarios). El
`Administrador Organizacion` ve el menú completo de organización.

---

## Patron ABM

Altas, bajas (lógicas) y modificaciones siguen el mismo esqueleto en catálogo, clientes, precios y
configuración.

```text
Listado
  |-- busqueda + filtros + paginacion
  |-- accion primaria "Nuevo" (si hay permiso de crear)
  |-- fila -> detalle / edicion
Crear o editar
  |-- formulario validado con el mismo esquema Zod que la API
  |-- guardar / cancelar
  |-- errores de campo bajo el input; errores de negocio arriba del formulario
Inactivar (no borrar)
  |-- confirmacion
  |-- el registro desaparece de listados activos; sigue en historicos
```

| Elemento | Comportamiento |
|----------|----------------|
| Listado vacio | Estado vacio con CTA de crear o importar si aplica |
| Busqueda | Debounce; parametro `search` de la API |
| Permisos | Ocultar botones de crear/editar sin permiso; no confiar solo en ocultar (la API rechaza) |
| Unicidad | Conflicto 409 mostrado en lenguaje claro ("Ya existe un SKU igual") |
| Soft delete | Nunca "Eliminar" fisico en datos de negocio; etiqueta "Inactivar" |

---

## Pantalla de cotizar

Pantalla crítica del producto. Objetivo: de mensaje pegado a borrador revisable en segundos, y a
aprobación en menos de un minuto.

### Bloques funcionales

| Bloque | Contenido |
|--------|-----------|
| Contexto | Sucursal activa, cliente (o nombre libre), lista de precios |
| Captura | Area de texto del mensaje WhatsApp (max 4000), canal `WHATSAPP_PEGADO` |
| Accion | Boton "Generar borrador" (`POST /api/precotizaciones`) |
| Resumen | Contadores del semaforo + totales |
| Lineas | Lista/tabla con semaforo, item, cantidad, precios, candidatos |
| Pie de acciones | Agregar linea, aprobar, (post-aprobacion) copiar WhatsApp / PDF |

### Maqueta movil (375px)

```text
+--------------------------------------+
| [=] Cotizar              Sucursal v  |
+--------------------------------------+
| Cliente: [ Buscar o nombre libre  v] |
| Lista:   Publico                     |
+--------------------------------------+
| Mensaje de WhatsApp                  |
| +----------------------------------+ |
| | hola, necesito 2 tubos de media  | |
| | 10 codos y un pegamento azul     | |
| +----------------------------------+ |
| [        Generar borrador          ] |
+--------------------------------------+
| Borrador #045          BORRADOR      |
| 2 resueltas · 1 revisar · 0 sin match|
| Subtotal 43.75  Total 50.75 USD      |
| Presentacion 1852.38 VES             |
+--------------------------------------+
| (verde) Tubo PVC 1/2"                |
|   pediste: tubos de 1/2              |
|   2 UND · 11.2500 · tot 22.5000      |
|   [cambiar]                          |
+--------------------------------------+
| (ambar) Codo — revisar               |
|   pediste: codos                     |
|   candidatos:                        |
|   1. Codo PVC 1/2"  0.78             |
|   2. Codo HG 1/2"   0.74             |
|   [elegir] [buscar item]             |
+--------------------------------------+
| (verde) Pegamento PVC                |
|   pediste: pegamento azul            |
|   1 UND · 8.7500                     |
+--------------------------------------+
| [+ Agregar linea]                    |
| [      Aprobar cotizacion         ]  |
+--------------------------------------+
| (nav) Inicio Cotizar Historial ...   |
+--------------------------------------+
```

### Maqueta escritorio

```text
+------------------------------------------------------------------+
| Logo  Inicio  Cotizar  Historial  Catalogo  Mas     Sucursal | Yo |
+-----------------------------+------------------------------------+
| Captura                     | Borrador #045 · BORRADOR           |
| Cliente [..............]    | 2 resueltas · 1 revisar · 0 sin    |
| Lista   [Publico     v]     |                                    |
| +-------------------------+ | # | Est | Descripcion    | Cant |  |
| | texto WhatsApp          | | 1 | ok  | Tubo PVC 1/2"  | 2    |  |
| |                         | | 2 | !   | Codo (revisar) | 10   |  |
| +-------------------------+ | 3 | ok  | Pegamento PVC  | 1    |  |
| [ Generar borrador ]        |                                    |
|                             | Panel candidatos (linea 2)         |
| Advertencia IA (si fallo)   |  · Codo PVC 1/2"  0.78  [Elegir]   |
|                             |  · Codo HG 1/2"   0.74  [Elegir]   |
|                             +------------------------------------+
|                             | Subtotal … Descuento … Impuesto …  |
|                             | Total 50.75 USD · 1852.38 VES      |
|                             | [Agregar] [Aprobar cotizacion]     |
+-----------------------------+------------------------------------+
```

### Interacciones de linea

| Accion | Efecto |
|--------|--------|
| Elegir candidato | Asigna item, `RESUELTA_MANUAL`, recalcula |
| Buscar item | Busqueda por similitud del catalogo |
| Cambiar cantidad | Recalculo inmediato con motor compartido |
| Quitar linea | Confirmacion si aplica; evento `LINEA_ELIMINADA` |
| Guardar alias | Checkbox/opcion explicita al corregir; nunca automatica |
| Sobrescribir precio | Solo con `cotizaciones.sobrescribir_precio`; motivo obligatorio |

Si la interpretación falla: banner de advertencia, borrador vacío, foco en “Agregar línea”. El
flujo no se bloquea.

---

## Estados vacios, carga y error

### Vacios

| Pantalla | Mensaje orientativo | CTA |
|----------|---------------------|-----|
| Historial sin cotizaciones | "Todavia no hay cotizaciones" | Ir a Cotizar |
| Catalogo sin items | "Carga el catalogo para poder cotizar" | Nuevo item / Importar |
| Busqueda sin resultados | "No hay coincidencias" | Limpiar busqueda |
| Terminos no resueltos vacio | "Ningun termino pendiente" | — |
| Hub Mas filtrado a casi nada | Solo cerrar sesion y perfil | — |
| Candidatos vacios en linea roja | "Sin candidatos; busca un item" | Buscar item |

Un estado vacío explica el siguiente paso; no culpa al usuario.

### Carga

| Situacion | Patron |
|-----------|--------|
| Generar borrador | Boton en loading; area de lineas con skeleton; no se permite doble envio |
| Listados | Skeleton de filas o spinner de seccion; mantener cabecera visible |
| Recalculo local | Instantaneo (shared); sin spinner de red |
| Guardar linea | Indicador en la fila o boton; Optimistic UI solo si la spec lo autoriza |

Tiempo percibido del pipeline: informar “Interpretando el pedido…” durante la espera; si supera
unos segundos, el mensaje puede mencionar que sigue en curso sin inventar progreso falso.

### Error

| Origen | Presentacion |
|--------|--------------|
| 400 validacion | Errores por campo |
| 401 | Refresco de sesion; si falla, a login |
| 403 | Toast o pagina "No tienes permiso" |
| 404 | "No encontrado" (incluye dato de otra organizacion) |
| 409 | Conflicto explicado en lenguaje de negocio |
| 422 | Regla de negocio (p. ej. no se puede aprobar con lineas en rojo) |
| 502 IA/PDF | Banner: se puede continuar en modo manual o reintentar documento |

Los códigos técnicos (`COTIZACION_SIN_LINEAS`, etc.) no se muestran crudos al cotizador; se mapean
en `lib` / catálogo de errores a frases en español.

---

## Accesibilidad

| Requisito | Aplicacion |
|-----------|------------|
| Contraste | Texto y semaforo cumplen contraste suficiente sobre fondo |
| Semaforo | Icono + texto; no solo color |
| Foco | Anillo visible en teclado; orden de tab en captura → generar → lineas → aprobar |
| Etiquetas | Todo input con `label` visible o `aria-label` |
| Dialogos | Foco atrapado; Escape cierra si no hay proceso obligatorio a medias |
| Iconos decorativos | `aria-hidden`; iconos informativos con texto asociado |
| Movimiento | Respetar `prefers-reduced-motion` en animaciones no esenciales |
| Objetivos tactiles | >= 44px en navegacion y acciones primarias |

La pantalla de cotizar debe ser usable solo con teclado en escritorio.

---

## Textos y tono

| Principio | Ejemplo correcto | Evitar |
|-----------|------------------|--------|
| Directo y de mostrador | "Generar borrador" | "Ejecutar pipeline de precotizacion" |
| Responsabilidad clara | "Revisa las lineas en ambar antes de aprobar" | "La IA cotizo estos montos" |
| Sin culpa | "No encontramos este pedido en el catalogo" | "Fallaste al escribir el producto" |
| Accion concreta | "Elige un candidato o busca un item" | "Error de resolucion" |
| Nomenclatura fija | "Item", "Cliente", "Organizacion" | "Producto", "Tenant" |

Tono: profesional, breve, en español de uso latinoamericano neutro. Sin emojis en la interfaz
estable del MVP. Los estados de cotización se muestran con la etiqueta del glosario (`Borrador`,
`Aprobada`, `Enviada`, etc.).

Microcopys frecuentes:

| Situacion | Texto |
|-----------|-------|
| Confirmar aprobacion | "Al aprobar se congelan precios, descuentos y tasa. No se podran editar las lineas." |
| Alias aprendido | "Guardar «tubo de media» como alias de este item" |
| IA fallida | "No se pudo interpretar el mensaje. Arma la cotizacion a mano o reintenta." |
| Tasa antigua | "La tasa de cambio tiene mas de un dia. Actualizala antes de aprobar si aplica." |

---

## Formato de datos

La API transporta importes como **cadenas decimales** y fechas en **ISO 8601 UTC**. El formateo
visible vive en `apps/web/src/lib/formato.ts` usando `locale` y monedas de la organización.

| Dato | Almacen / API | Presentacion |
|------|---------------|--------------|
| Importes | cadena `"1234.5600"` / `numeric(18,4)` | Segun `decimales` de la moneda y `decimalesRedondeo` de config; simbolo de moneda |
| Tasas | `"36.500000"` / `numeric(18,6)` | Hasta 6 decimales significativos |
| Cantidades | `"2.0000"` | Sin decimales basura si la unidad no admite decimales |
| Confianza / puntaje | `"0.7800"` | En UI de candidatos: porcentaje entero o dos decimales (`78%` o `0.78`); coherente en toda la app |
| Fechas | ISO UTC | Fecha/hora en `zonaHoraria` de la organizacion |
| Folio | texto ya formateado | Tal cual (`#045`); no recalcular en cliente |
| Telefono WhatsApp | tal cual en datos | Visible para copiar; no es enlace de API de WhatsApp en el MVP |
| SKU | mayusculas | Monospace o peso medio para distinguir |

Reglas:

1. No parsear importes con `parseFloat` para calcular: usar el motor decimal de `@cotizador/shared`.
2. No mostrar cuatro decimales de trabajo al cliente final en el PDF si la configuración redondea a
   dos; el documento sigue la plantilla y la config.
3. El total en moneda de presentación se etiqueta con tasa y fecha cuando corresponde (ADR 0008).
4. Estados y enums se traducen a etiquetas; los valores crudos (`RESUELTA_AUTOMATICA`) no aparecen
   en textos de usuario.

---

## Documentos relacionados

- `docs/specs/009-revision-aprobacion.md` — detalle de revision y aprobacion.
- `docs/specs/011-historial-y-metricas.md` — historial y reportes.
- `docs/04-flujo-precotizacion.md` — origen del semaforo y degradacion.
- `docs/decisions/0006-plantillas-de-documento.md` — PDF y texto WhatsApp.



