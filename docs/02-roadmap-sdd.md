# Roadmap del desarrollo dirigido por especificacion

Este documento es el indice operativo del proyecto: en que orden se especifica, se implementa y se
cierra cada modulo, y cual es el estado de cada pieza.

## Como trabajamos

El flujo es siempre el mismo y no se saltea:

```text
Especificar  →  Revisar  →  Diseñar datos  →  Rama desde testing  →  Implementar  →  PR a testing  →  Verificar  →  Cerrar
```

1. **Especificar.** Se escribe o refina la especificacion del modulo en `docs/specs/`. Debe tener
   objetivo, alcance con lo que no incluye, datos requeridos, reglas de negocio, permisos, API,
   errores, experiencia de usuario y criterios de aceptacion.
2. **Revisar.** Se revisan las reglas y los criterios antes de escribir codigo. Las preguntas abiertas
   se resuelven o se marcan explicitamente como diferidas.
3. **Diseñar datos.** Si el modulo toca el esquema, se actualiza `06-diseno-tecnico.md` y se escribe la
   migracion.
4. **Rama.** Se crea una rama desde `testing` por spec (`feature/spec-NNN-...`) o, si no aplica, por
   fase. Detalle en `10-convenciones-git-y-calidad.md`.
5. **Implementar.** Backend primero, luego interfaz. Nada fuera del alcance declarado.
6. **Integrar.** Se abre peticion de integracion hacia `testing`. Documentacion y codigo en el mismo PR.
7. **Verificar.** Se cubren los criterios de aceptacion, incluida siempre la prueba de aislamiento
   entre organizaciones.
8. **Cerrar.** Se agrega a la especificacion una seccion de cierre con la fecha, los entregables y la
   tabla de verificacion de cada criterio.

### Regla de avance

Una especificacion esta lista para implementarse cuando tiene:

- objetivo y alcance con su contraparte de lo que no incluye;
- datos requeridos con campos y obligatoriedad;
- reglas de negocio numeradas;
- criterios de aceptacion verificables;
- preguntas abiertas resueltas o marcadas como diferidas con su justificacion.

### Reglas permanentes

- `docs/` es la fuente de verdad. Si el codigo y la documentacion difieren, se corrige el que este
  equivocado en el mismo pull request.
- No se implementa nada que no este especificado.
- No se amplia el alcance de un modulo durante su implementacion. Lo que aparece se anota como
  pregunta abierta o pasa a una fase posterior.
- Las cotizaciones y sus eventos no se borran fisicamente nunca.
- Ningun importe puede provenir de la salida de un modelo de lenguaje.
- Se responde y se documenta en español.

---

## Estado de la documentacion transversal

| Documento | Contenido | Estado |
|-----------|-----------|--------|
| `00-vision.md` | Que construimos, para quien y la regla de oro | Cerrado |
| `01-glosario.md` | Vocabulario del dominio y nomenclatura obligatoria | Cerrado |
| `02-roadmap-sdd.md` | Este documento | Vivo |
| `03-verticales-y-packs.md` | Contenido de cada pack de vertical | Cerrado |
| `04-flujo-precotizacion.md` | Pipeline de cinco etapas con detalle de datos | Cerrado |
| `05-alcance-mvp.md` | Que entra y que no entra en el MVP | Cerrado |
| `06-diseno-tecnico.md` | Arquitectura, modelo de datos, seguridad y API | Cerrado |
| `07-convenciones-implementacion.md` | Como se escribe el codigo | Cerrado |
| `08-catalogo-errores.md` | Codigos de error y mensajes | Vivo |
| `09-guia-ux-ui.md` | Sistema visual y patrones de interfaz | Cerrado |
| `10-convenciones-git-y-calidad.md` | Ramas, commits, revision y calidad | Cerrado |
| `11-arquitectura-monorepo.md` | Estructura fisica y scripts | Cerrado |
| `12-infraestructura-docker.md` | Entornos, variables y puesta en marcha | Cerrado |

## Estado de las decisiones de arquitectura

| ADR | Decision | Estado |
|-----|----------|--------|
| `0001` | Multi-tenancy por columna de organizacion | Aceptada |
| `0002` | Catalogo generico con atributos JSON y packs de vertical | Aceptada |
| `0003` | Pipeline de precotizacion en etapas separadas | Aceptada |
| `0004` | Proveedor de IA abstraido y configurable | Aceptada |
| `0005` | Motor de precios determinista y puro | Aceptada |
| `0006` | Plantillas de documento declarativas | Aceptada |
| `0007` | Resolucion de items por alias y similitud textual | Aceptada |
| `0008` | Moneda base de calculo y moneda de presentacion con tasa congelada | Aceptada |
| `0009` | Stack tecnologico | Aceptada |
| `0010` | Monorepo y paquetes | Aceptada |
| `0011` | Auditoria y trazabilidad | Aceptada |
| `0012` | Infraestructura y entornos | Aceptada |

---

## Fases de implementacion

### Fase 0 — Cimientos

| Entregable | Especificacion | Estado |
|-----------|----------------|--------|
| Monorepo, configuracion de herramientas, Docker de desarrollo | `11-arquitectura-monorepo.md`, `12-infraestructura-docker.md` | Cerrado |
| Paquete compartido: errores, tipos, permisos, normalizacion de texto | `07-convenciones-implementacion.md` | Cerrado |
| Migracion inicial con extensiones, tablas globales y semilla de permisos y perfiles | `06-diseno-tecnico.md` | Cerrado |
| Salud de API, filtro de errores, paginacion base y esqueleto de contexto | `docs/pr/fase-0-cimientos.md` | Cerrado |

Rama: integrada en `master` / `testing` como commit base del repositorio.

Criterio de salida: la API arranca, responde el endpoint de salud, la base de datos migra desde cero y
la semilla crea permisos, perfiles y el superadmin de plataforma.

### Fase 1 — Plataforma y seguridad

Orden de PR sugerido (uno por spec, base `testing`):

1. `feature/spec-001-usuarios-perfiles` — autenticacion y sesiones (en curso)
2. `feature/spec-000-plataforma-organizaciones` — organizaciones y provisionamiento
3. `feature/spec-002-configuracion-organizacion` — config, sucursales y resto de 001/002
4. Interfaz ABM de usuarios (`/configuracion/usuarios`) si no entra en el PR de 001

| Entregable | Especificacion | Estado |
|-----------|----------------|--------|
| Autenticacion, sesiones, refresco, cambio de contraseña | `specs/001-usuarios-perfiles.md` | En curso |
| Organizaciones y provisionamiento por vertical | `specs/000-plataforma-organizaciones.md` | En implementacion |
| Usuarios, perfiles y sucursales de la organizacion | `specs/001`, `specs/002` | En curso (API 001) |
| Configuracion de la organizacion | `specs/002-configuracion-organizacion.md` | Pendiente |
| Interfaz: login, guardas, navegacion y hub de configuracion | `09-guia-ux-ui.md` | En curso (acceso/panel) |

Criterio de salida: se puede registrar una organizacion, provisionarla, crear su administrador y sus
cotizadores, e iniciar sesion con permisos diferenciados.

### Fase 2 — Catalogo y precios

| Entregable | Especificacion | Estado |
|-----------|----------------|--------|
| Maestras: unidades, categorias, marcas, definiciones de atributo | `specs/003-maestras-catalogo.md` | Pendiente |
| Items, atributos validados, alias, aplicaciones y busqueda por similitud | `specs/004-catalogo-items.md` | Pendiente |
| Listas de precios, precios por item, reglas de descuento y tasas | `specs/006-listas-precios-reglas.md` | Pendiente |
| Motor de precios puro con su bateria de pruebas | `decisions/0005-motor-de-precios.md` | Pendiente |
| Importacion de items, precios y alias | `specs/005-importacion-catalogo.md` | Pendiente |
| Clientes | `specs/007-clientes.md` | Pendiente |

Criterio de salida: una organizacion puede cargar 300 items por importacion, definir dos listas de
precios con reglas de descuento y buscar un item escribiendolo mal.

### Fase 3 — El nucleo del producto

| Entregable | Especificacion | Estado |
|-----------|----------------|--------|
| Pipeline de precotizacion con proveedor simulado | `specs/008-precotizacion-ia.md` | Pendiente |
| Resolucion contra catalogo con umbrales y candidatos | `decisions/0007-estrategia-de-matching.md` | Pendiente |
| Pantalla de cotizar y revision con semaforo | `specs/009-revision-aprobacion.md` | Pendiente |
| Aprobacion con congelamiento y texto para WhatsApp | `specs/009-revision-aprobacion.md` | Pendiente |
| Proveedor de IA real y ajuste de umbrales | `specs/008-precotizacion-ia.md` | Pendiente |

Criterio de salida: se pega un mensaje real de cinco items y se obtiene un borrador aprobable en menos
de un minuto, con el texto listo para pegar en WhatsApp.

### Fase 4 — Documento e historial

| Entregable | Especificacion | Estado |
|-----------|----------------|--------|
| Plantilla de documento configurable con vista previa | `specs/010-plantillas-documento.md` | Pendiente |
| Generacion y almacenamiento del PDF | `specs/010-plantillas-documento.md` | Pendiente |
| Historial con filtros, duplicado y estados finales | `specs/011-historial-y-metricas.md` | Pendiente |
| Metricas del piloto | `specs/011-historial-y-metricas.md` | Pendiente |

Criterio de salida: el PDF sale con la identidad de la organizacion y las metricas permiten decidir si
el piloto funciona.

### Fase 5 — Piloto

| Actividad | Descripcion |
|-----------|-------------|
| Preparacion | Carga del catalogo real de mayor rotacion y curado inicial de alias |
| Semana 1 | Uso en paralelo al metodo actual, medicion de tiempo por cotizacion |
| Semana 2 | Uso como metodo principal para las cotizaciones de WhatsApp |
| Ajuste | Revision de terminos fallidos, alta de alias, ajuste de umbrales |
| Evaluacion | Comparacion contra las señales de exito |

#### Señales de que vale la pena seguir

- Baja el tiempo por cotizacion de forma medible.
- Se responden mas solicitudes por dia.
- La tasa de lineas resueltas automaticamente sube al curar alias.
- El operador no quiere volver al metodo anterior.
- Hay disposicion a pagar por el uso continuado.

---

## Estado de las especificaciones

| Spec | Modulo | Estado | Fase |
|------|--------|--------|------|
| `000` | Plataforma y organizaciones | En implementacion | 1 |
| `001` | Usuarios, perfiles y permisos | Especificada | 1 |
| `002` | Configuracion de la organizacion | Especificada | 1 |
| `003` | Maestras del catalogo | Especificada | 2 |
| `004` | Catalogo de items | Especificada | 2 |
| `005` | Importacion de catalogo | Especificada | 2 |
| `006` | Listas de precios y reglas | Especificada | 2 |
| `007` | Clientes | Especificada | 2 |
| `008` | Precotizacion con IA | Especificada | 3 |
| `009` | Revision y aprobacion | Especificada | 3 |
| `010` | Plantillas de documento | Especificada | 4 |
| `011` | Historial y metricas | Especificada | 4 |

Estados posibles de una especificacion: `Borrador`, `Especificada`, `Lista para implementar`,
`En implementacion`, `Implementado`.

---

## Diferido a fases posteriores

Se anota aqui para no perderlo y para no discutirlo dos veces durante el MVP.

| Tema | Fase prevista | Nota |
|------|---------------|------|
| Interpretacion de notas de voz e imagenes | 2 | Se agrega como etapa previa a la extraccion de lineas |
| Busqueda semantica con embeddings | 2 | Se agrega como estrategia de la cascada de resolucion |
| Integracion con WhatsApp Business API | 3 | Requiere revisar el modelo de canal de la solicitud |
| Suscripciones y cobro dentro del producto | 2 | Requiere modelo de plan y limites de uso |
| Tarea programada de vencimiento de cotizaciones | 2 | En el MVP el vencimiento se evalua al consultar |
| Row Level Security como refuerzo del aislamiento | 2 | El modelo actual ya es compatible |
| Sincronizacion de packs de vertical hacia organizaciones existentes | 2 | Comando explicito y revisable |
| Aplicacion movil nativa | Sin planificar | La web responsive cubre el caso de mostrador |
