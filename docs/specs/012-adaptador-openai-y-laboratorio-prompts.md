# Spec 012: Adaptador OpenAI y laboratorio de prompts

## Estado

Cerrada — implementada (2026-09-19); enmienda politica por vertical (2026-09-19)

## Objetivo

Conectar el pipeline de precotizacion a un proveedor de IA real (OpenAI) y dotar al ambito
plataforma de un **laboratorio de prompts**: versiones de politica editables, publicables y
activables sin redeploy, con evaluacion previa basada en textos historicos normalizados.

El contrato de salida (schema estricto, prohibicion de importes e ids) permanece inmutable en codigo.
La politica (blacklist, few-shots, instrucciones) es lo que el superadmin itera.

Invariantes que esta especificacion no negocia: ningun importe proviene de la salida del LLM; el
fallo de IA produce borrador vacio, nunca bloquea al operador; la configuracion del proveedor y la
clave son de plataforma; la organizacion solo activa o desactiva `usaIa`.

## Dependencias

| Documento | Aporta |
|-----------|--------|
| `docs/decisions/0004-proveedor-de-ia-abstraido.md` | Interfaz `ProveedorIa`, timeout, reintento, proveedores |
| `docs/decisions/0003-pipeline-precotizacion.md` | Etapa de extraccion unica invocacion al LLM |
| `docs/specs/008-precotizacion-ia.md` | Contrato Zod de lineas, codigos `IA_*`, traza |
| `docs/specs/000-plataforma-organizaciones.md` | Ambito plataforma y permisos |
| `docs/06-diseno-tecnico.md` | Adaptadores externos fuera del dominio |

Requisitos previos: pipeline 008 operativo con `mock`/`none`; interpretaciones persistidas;
usuario superadmin de plataforma.

## Alcance MVP v1

Incluye:

- Adaptador `ProveedorIaOpenAI` seleccionado con `IA_PROVEEDOR=openai`.
- Salida estructurada (JSON Schema estricto alineado al Zod de extraccion).
- Tabla `prompt_versiones` (plataforma, sin `organizacionId`) con estados
  `BORRADOR` | `PUBLICADA` | `ACTIVA` | `ARCHIVADA`.
- Composicion en tres capas: contrato (codigo) + politica (BD) + contexto (request).
- Endpoints y UI de plataforma para listar, editar borradores, publicar, activar y evaluar.
- Semilla de politicas ACTIVA por vertical (`FERRETERIA`, `GENERICO` como fallback).
- Variables de entorno de modelo, temperatura y tarifas de costo estimado.
- **Politica por vertical**: como maximo una ACTIVA por `(proposito, verticalCodigo)`. Resolucion:
  vertical de la org → `GENERICO` → politica embebida en codigo. Sin override por organizacion.

No incluye en esta version:

| Fuera de alcance | Motivo |
|------------------|--------|
| Clave o modelo por organizacion | ADR 0004; costo de custodia |
| Politica de prompt por organizacion | La vertical cubre el rubro; override por org diferido |
| Adaptador Ollama | Diferido; la interfaz ya lo permite |
| Fine-tuning o embeddings de catalogo | Sin volumen etiquetado |
| Que el LLM resuelva items del catalogo | Sigue siendo etapa 3 determinista |
| Edicion del contrato (schema / prohibiciones) desde UI | Seguridad del producto |

## Conceptos principales

| Concepto | Definicion operativa |
|----------|----------------------|
| Contrato | Texto y schema inmutables en codigo (`contrato-extraccion.v1`). Define que puede devolver el LLM |
| Politica | JSON versionado en BD: blacklist, reglas de cantidad, few-shots, instrucciones extra |
| Contexto | Datos de la request: `textoNormalizado`, `unidadesValidas`, `limiteLineas` |
| Prompt compuesto | System + user armados por `PromptComposer` a partir de las tres capas |
| Version de prompt | Fila en `prompt_versiones` con `codigo` y `verticalCodigo` |
| Vertical de politica | Codigo de vertical (`FERRETERIA`, `AUTOMOTRIZ`, …, `GENERICO`) que agrupa el rubro |
| Evaluacion | Replay de N textos historicos normalizados contra una version candidata; solo agregados |

## Datos requeridos

### Tabla `prompt_versiones` (global de plataforma)

| Campo | Obligatorio | Descripcion |
|-------|-------------|-------------|
| `id` | Si | UUID |
| `proposito` | Si | Valor fijo `EXTRACCION_LINEAS` en el MVP |
| `verticalCodigo` | Si | Codigo de vertical (`FERRETERIA`, `GENERICO`, …). No es FK dura: se valida contra catalogo al crear |
| `codigo` | Si | Unico global. Ej. `extraccion-lineas.FERRETERIA.v1` |
| `estado` | Si | `BORRADOR`, `PUBLICADA`, `ACTIVA`, `ARCHIVADA` |
| `contratoVersion` | Si | Ref al contrato en codigo, ej. `contrato-extraccion.v1` |
| `politica` | Si | JSONB validado con Zod |
| `notasCambio` | No | Texto libre del cambio |
| `ultimaEvaluacion` | No | JSONB con agregados del ultimo `evaluar` |
| `createdById` | No | Usuario de plataforma que creo el borrador |
| `publishedAt` | No | Marca de publicacion |
| `activatedAt` | No | Marca de activacion |
| `createdAt` / `updatedAt` | Si | Auditoria |

Invariante: como maximo **una** fila `ACTIVA` por `(proposito, verticalCodigo)`.

### Politica (JSONB)

```typescript
type PoliticaExtraccion = {
  blacklist: string[];           // frases/palabras que no son lineas de pedido
  reglasCantidad: string;        // instrucciones de cantidad asumida, etc.
  fewShots: FewShotExtraccion[]; // ejemplos entrada → lineas
  instruccionesExtra: string;    // texto libre acotado
};

type FewShotExtraccion = {
  entrada: string;
  lineas: Array<{
    textoSolicitado: string;
    cantidad: string;
    unidad?: string;
    notas?: string;
  }>;
};
```

## Reglas de negocio

1. La seleccion del adaptador sigue siendo por `IA_PROVEEDOR` al arrancar el modulo.
2. Con `openai`, cada extraccion usa la version `ACTIVA` de `EXTRACCION_LINEAS` para la
   `verticalCodigo` de la organizacion; si no hay, la de `GENERICO`; si tampoco, la politica
   embebida en codigo (advertencia `PROMPT_ACTIVO_AUSENTE`).
3. El `versionPrompt` persistido en la interpretacion es el `codigo` de la version usada.
4. Solo se edita una version en `BORRADOR`. `PUBLICADA` y `ACTIVA` son inmutables en `politica`.
5. Publicar exige estado `BORRADOR` y pasa a `PUBLICADA`.
6. Activar exige `PUBLICADA` o `ACTIVA` (idempotente). La ACTIVA previa **de la misma vertical**
   pasa a `PUBLICADA`.
7. Evaluar no cambia estado. Persiste `ultimaEvaluacion` con agregados:
   `muestras`, `jsonValido`, `salidaInvalida`, `ceroLineas`, `latenciaMsP50` (si aplica).
8. La evaluacion **no** expone textos de solicitud ni nombres de cliente en la respuesta de UI;
   solo conteos e ids internos de interpretacion opcionales en logs de servidor.
9. OpenAI usa Structured Outputs con JSON Schema estricto derivado del contrato Zod.
10. Temperatura por defecto `0`. Timeout y reintento siguen la spec 008.
11. No se envia catalogo, precios, SKU ni ids de items al modelo.
12. El adaptador OpenAI vive en `apps/api`; el dominio no importa el SDK.

## Permisos

| Permiso | Uso |
|---------|-----|
| `plataforma.ia.ver` | Listar versiones, ver config (sin API key), ver ultima evaluacion |
| `plataforma.ia.editar` | Crear/editar borrador, publicar, activar, evaluar |

El perfil `SUPERADMIN_PLATAFORMA` (`plataforma.*`) los cubre por patron.

## API

| Metodo | Ruta | Permiso |
|--------|------|---------|
| GET | `/api/plataforma/ia/config` | `plataforma.ia.ver` |
| GET | `/api/plataforma/ia/prompts` | `plataforma.ia.ver` |
| POST | `/api/plataforma/ia/prompts` | `plataforma.ia.editar` |
| PATCH | `/api/plataforma/ia/prompts/:id` | `plataforma.ia.editar` |
| POST | `/api/plataforma/ia/prompts/:id/publicar` | `plataforma.ia.editar` |
| POST | `/api/plataforma/ia/prompts/:id/activar` | `plataforma.ia.editar` |
| POST | `/api/plataforma/ia/prompts/:id/evaluar` | `plataforma.ia.editar` |

Todos exigen ambito `PLATAFORMA`.

### Variables de entorno

| Variable | Default | Uso |
|----------|---------|-----|
| `IA_PROVEEDOR` | `mock` | `openai` \| `mock` \| `none` |
| `IA_MODELO` | `gpt-4o-mini` | Modelo OpenAI |
| `IA_TEMPERATURA` | `0` | Temperatura |
| `IA_TIMEOUT_MS` | `20000` | Timeout |
| `IA_MAX_CARACTERES` | `4000` | Tope de texto |
| `OPENAI_API_KEY` | — | Obligatorio si proveedor `openai` |
| `IA_COSTO_ENTRADA_POR_1K` | `0.00015` | Estimacion USD |
| `IA_COSTO_SALIDA_POR_1K` | `0.0006` | Estimacion USD |

## UI

Ruta `/plataforma/ia` en el cascaron de plataforma:

- Resumen de config (proveedor, modelo, clave configurada si/no).
- Lista de versiones con estado.
- Editor de politica en borrador (blacklist, reglas, few-shots, instrucciones).
- Preview del prompt compuesto (contrato bloqueado + politica + ejemplo de contexto).
- Acciones Publicar, Activar, Evaluar con resultado agregado.

## Criterios de aceptacion

1. Con `IA_PROVEEDOR=openai` y clave valida, un mensaje WhatsApp real produce lineas sin precios;
   la interpretacion guarda `proveedor=openai`, `modelo` y `versionPrompt` de la ACTIVA.
2. Una respuesta con campos prohibidos falla Zod con `IA_SALIDA_INVALIDA` y borrador vacio (201).
3. Sin clave o con error de red tras reintento: `IA_PROVEEDOR_NO_DISPONIBLE`, borrador vacio.
4. Superadmin crea borrador, publica y activa sin redeploy; la siguiente precotizacion usa el nuevo
   `codigo`.
5. Evaluar sobre N>=1 muestras (si existen) devuelve agregados sin textos de cliente.
6. Usuario de organizacion recibe `CONTEXTO_PLATAFORMA_REQUERIDO` en rutas `/plataforma/ia/*`.
7. `mock` y `none` siguen funcionando sin red ni clave.

## Preguntas abiertas

Ninguna bloqueante. Ollama y claves por organizacion quedan diferidos explicitamente.

## Cierre

Cerrada — implementada (2026-09-19)

### Entregables

- Spec 012 + enmienda ADR 0004 + roadmap + catálogo de errores `PROMPT_*`
- Shared: política Zod, contrato `contrato-extraccion.v1`, JSON Schema OpenAI, `componerPromptExtraccion`
- DB: `prompt_versiones` (+ `verticalCodigo`), migraciones, seed por vertical (`FERRETERIA`, `GENERICO`)
- API: `ProveedorIaOpenAI`, `IaModule`, endpoints `/api/plataforma/ia/*`, resolución por vertical
- Web: `/plataforma/ia` laboratorio con filtro/crear por vertical

### Verificación de criterios

| CA | Resultado |
|----|-----------|
| 1 OpenAI + traza versionPrompt ACTIVA | Cableado; requiere `IA_PROVEEDOR=openai` + `OPENAI_API_KEY` en runtime |
| 2 Campos prohibidos → IA_SALIDA_INVALIDA | Zod estricto + Structured Outputs |
| 3 Red/sin clave | Factory falla sin key; errores de red → `IA_PROVEEDOR_NO_DISPONIBLE` |
| 4 Borrador → publicar → activar sin redeploy | Endpoints + UI |
| 5 Evaluar agregados sin textos de cliente | `POST .../evaluar` |
| 6 Org → CONTEXTO_PLATAFORMA_REQUERIDO | `requirePlataformaContext` |
| 7 mock/none sin red | Factory `mock`/`none` intactos |
