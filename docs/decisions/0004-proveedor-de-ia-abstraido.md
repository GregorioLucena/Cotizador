# ADR 0004: Proveedor de IA abstraido y configurable

## Estado

Aceptada — 2026-09-17

## Contexto

La etapa de extraccion de lineas necesita un modelo de lenguaje. El mercado de modelos cambia cada
pocos meses en precio, calidad y disponibilidad. Ademas hay tres escenarios distintos que el producto
debe soportar:

- Produccion con un servicio remoto de pago, donde importa el costo por solicitud.
- Desarrollo y demostraciones sin costo, idealmente con un modelo local.
- Operacion degradada sin IA, ya sea por fallo del proveedor o porque una organizacion prefiere no
  usarla.

Si el proveedor queda acoplado al codigo del modulo de cotizaciones, cambiarlo obliga a tocar logica
de negocio y las pruebas dependen de la red.

## Decision

Se define una **interfaz unica de proveedor de IA** en el paquete compartido, con implementaciones
intercambiables seleccionadas por configuracion de entorno.

```typescript
export interface ProveedorIa {
  readonly nombre: string;
  readonly modelo: string;
  readonly versionPrompt: string;
  extraerLineas(entrada: EntradaExtraccion): Promise<ResultadoExtraccion>;
}

export type EntradaExtraccion = {
  textoNormalizado: string;
  unidadesValidas: string[];
  limiteLineas: number;
};

export type ResultadoExtraccion = {
  lineas: LineaExtraida[];
  advertencias: string[];
  metricas: {
    latenciaMs: number;
    tokensEntrada?: number;
    tokensSalida?: number;
    costoEstimado?: number;
  };
};
```

### Implementaciones previstas

| Implementacion | Valor de `IA_PROVEEDOR` | Uso |
|----------------|-------------------------|-----|
| Remota | `openai` | Produccion, con modelo economico configurable |
| Local | `ollama` | Desarrollo y demostraciones sin costo |
| Nula | `none` | Fuerza el modo manual: devuelve cero lineas y una advertencia |
| Simulada | `mock` | Pruebas automatizadas, respuestas fijas por caso |

### Reglas

1. La seleccion del proveedor se hace una sola vez, al construir el modulo, a partir de variables de
   entorno. Ningun servicio de dominio importa un SDK de un proveedor concreto.
2. El nombre del proveedor, el modelo y la version del prompt se persisten en cada interpretacion.
   Cambiar el prompt exige incrementar `versionPrompt`, porque de eso depende poder comparar la
   calidad del reconocimiento entre versiones.
3. La salida se valida siempre con un esquema Zod estricto antes de usarse. Una respuesta que no
   valide es un fallo de la etapa, se registra con el texto crudo recibido y **no** se intenta
   reparar heuristicamente.
4. Toda llamada tiene un tiempo limite configurable (`IA_TIMEOUT_MS`, valor inicial 20000). Al
   expirar, la etapa falla de forma controlada.
5. Se permite como maximo un reintento, y solo ante error de red o codigo 429 o 5xx, con espera breve.
   Un error de validacion de esquema no se reintenta.
6. Los fallos del proveedor **nunca** propagan una excepcion al usuario: producen un borrador sin
   lineas y un aviso en pantalla. El operador puede armar la cotizacion a mano.
7. El texto del cliente que se envia al proveedor se limita en longitud
   (`IA_MAX_CARACTERES`, valor inicial 4000) para acotar costo y evitar abuso.
8. La configuracion del proveedor es de plataforma, no de organizacion, en el MVP. La organizacion
   solo puede activar o desactivar el uso de IA y ajustar los umbrales de confianza.

### Prompt como artefacto versionado

El prompt vive en un archivo del repositorio, no en base de datos ni incrustado en una cadena dentro
de un servicio. Se versiona con la convencion `extraccion-lineas.v1.md`. Cada version documenta que
cambio y por que.

## Alternativas descartadas

### Llamar directamente al SDK del proveedor desde el servicio de cotizaciones

**Pros:** menos codigo, menos indireccion.
**Contras:** pruebas dependientes de red y credenciales, cambio de proveedor invasivo, imposible
demostrar el producto sin cuenta de pago.
**Descartada.**

### Permitir que cada organizacion configure su propio proveedor y su propia clave

**Pros:** trasladar el costo de IA a cada organizacion, permitir modelos distintos por cliente.
**Contras:** obliga a cifrar y custodiar credenciales de terceros, multiplica los modos de fallo y
complica el soporte; ademas el costo real por organizacion es bajo.
**Descartada para el MVP.** Se reevaluara cuando el volumen lo justifique, y el diseño ya lo permite
porque la seleccion del proveedor esta encapsulada.

### Ajuste fino de un modelo propio

**Pros:** posible mejor precision en el vocabulario del rubro.
**Contras:** requiere volumen de datos etiquetados que todavia no existe y añade un ciclo de
reentrenamiento a la operacion.
**Descartada.** Los datos para hacerlo se estan acumulando desde el MVP, porque cada correccion del
operador queda registrada.

## Consecuencias

- Se puede desarrollar y demostrar el producto completo sin gastar en IA.
- Las pruebas del pipeline usan el proveedor simulado y son deterministas.
- Cambiar de modelo es una variable de entorno y, si acaso, una version de prompt nueva.
- Se puede medir el costo real por cotizacion, porque cada interpretacion guarda tokens y costo
  estimado.
- Existe el riesgo de que la abstraccion quede corta si un proveedor futuro ofrece capacidades muy
  distintas, como salida estructurada nativa o llamadas a herramientas. Se acepta: la interfaz es
  pequeña y se puede extender.

## Referencias

- `docs/specs/008-precotizacion-ia.md`
- `decisions/0003-pipeline-precotizacion.md`
