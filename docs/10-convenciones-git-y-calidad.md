# Convenciones de Git y calidad de codigo

Este documento fija como se organiza el trabajo en el repositorio: ramas, commits, peticiones de
integracion, revision de codigo y herramientas de calidad. Es prescriptivo. Lo que aqui dice "debe" es
condicion para integrar un cambio.

El objetivo no es la prolijidad por si misma. Es que cualquier persona pueda abrir un modulo y ver de
inmediato donde se filtra por organizacion, donde se verifican permisos, donde se calculan importes y
donde se registra el evento de auditoria. Esas cuatro cosas son las que este documento protege.

## Estrategia de ramas

### Ramas base

| Rama | Rol | Quien la modifica |
|------|-----|-------------------|
| `master` | Produccion. Refleja siempre lo que esta desplegado | Solo por integracion desde `testing` o desde una rama `hotfix/` |
| `testing` | Integracion. Acumula el trabajo terminado y validado antes de publicar | Solo por integracion desde ramas de trabajo |

No se trabaja nunca de forma directa sobre `master` ni sobre `testing`. Toda rama de trabajo nace de
`testing`, excepto las de correccion urgente, que nacen de `master`.

La rama por defecto del repositorio remoto debe ser `testing`, para que las peticiones de integracion
apunten al lugar correcto del trabajo diario.

### Unidad de trabajo: una spec (o una fase) por rama

El trabajo de implementacion se abre **siempre** desde `testing` y se integra **siempre** hacia
`testing` mediante una peticion de integracion. La unidad preferida es **una especificacion**:

| Caso | Rama | Base del PR |
|------|------|-------------|
| Implementar una spec de `docs/specs/` | `feature/spec-NNN-<slug>` | `testing` |
| Entrega transversal sin spec numerada (cimientos, infra) | `feature/fase-N-<slug>` | `testing` |
| Correccion puntual | `bugfix/<slug>` o `hotfix/<slug>` | `testing` o `master` |

Reglas:

1. **Preferir una rama por spec.** Si el titulo del PR necesita "y" entre dos specs, son dos PR.
2. **Fase completa solo cuando no se puede partir.** La fase 0 (cimientos) es el ejemplo tipico: no
   hay una sola spec numerada que cubra el monorepo.
3. Cada PR enlaza su spec (o el documento de fase) y cierra o avanza el estado en el roadmap en el
   mismo cambio.
4. El orden de specs dentro de una fase lo marca `docs/02-roadmap-sdd.md`; no se salta una
   dependencia sin anotarlo en la spec.

### Prefijos de rama

| Prefijo | Uso | Ejemplo |
|---------|-----|---------|
| `feature/` | Funcionalidad nueva (spec o fase) | `feature/spec-000-plataforma-organizaciones` |
| `bugfix/` | Correccion de un defecto no urgente | `bugfix/descuento-cantidad-limite` |
| `hotfix/` | Correccion urgente sobre produccion | `hotfix/fuga-filtro-organizacion` |
| `docs/` | Cambios de documentacion | `docs/adr-stack-tecnologico` |
| `chore/` | Mantenimiento, dependencias, configuracion | `chore/actualizar-prettier` |

Formato:

```text
<prefijo>/<descripcion-corta-en-kebab-case>
```

Para specs, el slug incluye el numero y el nombre del archivo sin extension:
`feature/spec-004-catalogo-items`. La descripcion va sin tildes y sin mayusculas.

### Flujo

```text
master                    produccion
  ^
  |
testing                   integracion
  |
  +-- feature/aprobacion-cotizacion
  |     |  commits pequeños y coherentes
  |     |  typecheck, lint, test
  |     +-> peticion de integracion hacia testing
  |
  +-- bugfix/descuento-cantidad-limite
```

Pasos:

1. Actualizar `testing` y crear la rama de trabajo desde ahi.
2. Implementar un cambio acotado, con commits pequeños.
3. Ejecutar los scripts de calidad en local.
4. Abrir la peticion de integracion hacia `testing`.
5. Integrar cuando cumpla el checklist de revision.
6. Publicar promoviendo `testing` a `master`.

### Correccion urgente

1. Crear `hotfix/...` desde `master`.
2. Corregir con el cambio minimo que resuelve el problema.
3. Integrar en `master` y desplegar.
4. Integrar el mismo cambio en `testing` en el mismo dia, para que no se pierda en la siguiente
   publicacion.

Un `hotfix/` no lleva refactor ni mejoras oportunistas. Solo la correccion.

## Commits

Se usa Conventional Commits en español, con el ambito nombrado segun el modulo del dominio.

```text
<tipo>(<ambito>): <descripcion en minuscula, en imperativo, sin punto final>
```

### Tipos permitidos

| Tipo | Uso |
|------|-----|
| `feat` | Funcionalidad nueva visible para el usuario |
| `fix` | Correccion de un defecto |
| `docs` | Documentacion, incluidos los ADR y las especificaciones |
| `refactor` | Cambio interno sin alterar el comportamiento |
| `test` | Pruebas nuevas o ajustadas |
| `chore` | Dependencias, configuracion, infraestructura |
| `style` | Formato sin efecto funcional |

### Ambitos del dominio

`plataforma`, `organizaciones`, `usuarios`, `auth`, `catalogo`, `atributos`, `alias`, `importacion`,
`precios`, `clientes`, `solicitudes`, `ia`, `resolucion`, `cotizaciones`, `documentos`, `plantillas`,
`metricas`, `database`, `shared`, `web`, `docker`.

### Ejemplos reales

```text
feat(cotizaciones): agrega aprobacion con congelamiento de precios
feat(resolucion): agrega estrategia de alias exacto a la cascada
feat(alias): guarda alias aprendido al corregir una linea del borrador
feat(plantillas): agrega columna de tipo atributo al documento
fix(precios): aplica el redondeo una sola vez al final de la linea
fix(catalogo): filtra items inactivos en la busqueda del borrador
fix(auth): toma organizacionId del contexto y no del cuerpo de la peticion
refactor(ia): extrae la validacion de la respuesta al esquema compartido
test(precios): cubre dos reglas de descuento con la misma prioridad
docs(decisions): agrega ADR 0011 de auditoria y trazabilidad
chore(docker): instala chromium en la imagen de la api
```

### Reglas de commit

- Un commit, una intencion. No se mezcla refactor con funcionalidad si se puede evitar.
- El mensaje describe el efecto en el dominio, no el archivo modificado.
- Un commit que cambia una regla de negocio debe poder rastrearse a una especificacion o a un ADR.
- No se versionan archivos `.env`, credenciales, volcados de base de datos ni artefactos de
  compilacion.
- `pnpm-lock.yaml` se versiona siempre.

### Politica de commits

**No se hacen commits sin peticion explicita del usuario.** El agente de inteligencia artificial y
cualquier automatismo del proyecto escriben y modifican archivos, pero no ejecutan `git commit`,
`git push`, `git merge` ni ninguna operacion que altere la historia del repositorio salvo que se pida
de forma expresa en esa conversacion. Una peticion generica de implementar una funcionalidad no incluye
versionar los cambios.

Motivo: quien revisa debe poder inspeccionar el arbol de trabajo antes de que exista un commit, y la
agrupacion de cambios en commits es una decision de la persona, no del automatismo.

## Peticiones de integracion

### Reglas

1. Una peticion de integracion resuelve **una** funcionalidad, correccion o tarea tecnica. Si el titulo
   necesita la palabra "y", probablemente sean dos.
2. La descripcion indica que cambia, por que, y con que especificacion o ADR se relaciona.
3. Si el cambio toca una regla de negocio, enlaza la especificacion correspondiente de `docs/specs/`.
4. Los scripts de calidad deben pasar antes de solicitar revision, no durante.
5. **La documentacion se actualiza en la misma peticion de integracion que el codigo.** Si el cambio
   altera un contrato, una regla de precios, un permiso, una variable de entorno o el modelo de datos, el
   documento afectado se modifica en el mismo cambio. No se admiten peticiones de integracion que dejen
   la documentacion "para despues": una documentacion desactualizada es peor que ninguna, porque induce a
   error a quien confia en ella.
6. Si durante la implementacion se toma una decision de arquitectura que no estaba escrita, se agrega un
   ADR en la misma peticion de integracion.
7. Una peticion de integracion que deja pruebas en rojo no se integra, ni siquiera con un comentario que
   lo justifique.

### Checklist de revision

Los tres primeros puntos son obligatorios en toda peticion de integracion que toque la API. No se
integra sin verificarlos de forma explicita, no por suposicion.

#### Obligatorios

- [ ] **Filtrado por `organizacionId`.** Toda consulta de lectura y de escritura incluye la condicion
      `organizacionId = ctx.organizacionId`, tomada del `OrgContext` y nunca de un parametro de la
      peticion. En actualizaciones la condicion va en el `WHERE`, no en una comprobacion posterior en
      memoria. Un registro ajeno se responde como no encontrado, nunca como prohibido. Ver
      `decisions/0001-multi-tenancy-por-organizacion.md`.
- [ ] **Ningun importe proviene de la inteligencia artificial.** Ningun precio, descuento, subtotal,
      impuesto, tasa ni total se lee, directa o indirectamente, de la salida del proveedor de IA. El
      esquema que valida esa salida sigue rechazando campos no declarados. Los importes salen del motor
      de precios de `@cotizador/shared` a partir del catalogo. Ver
      `decisions/0003-pipeline-precotizacion.md` y `decisions/0005-motor-de-precios.md`.
- [ ] **Permisos verificados en el servicio.** La autorizacion se comprueba en la capa de servicio con
      el codigo de permiso correspondiente, no solo en el controlador y nunca solo en la interfaz. Que
      la web oculte un boton no es un control de acceso.

#### Correccion

- [ ] El cambio corresponde a lo que dice la especificacion, o la especificacion se actualizo.
- [ ] Las transiciones de estado de cotizacion respetan la tabla de `docs/01-glosario.md`.
- [ ] Las operaciones que cambian el estado de una cotizacion registran su evento en
      `cotizacion_eventos`, dentro de la misma transaccion.
- [ ] No se emite ninguna sentencia de borrado fisico sobre datos de negocio. Ver
      `decisions/0011-auditoria-y-trazabilidad.md`.
- [ ] Las entidades nuevas llevan `createdAt`, `updatedAt`, `createdById`, `updatedById` y, segun
      corresponda, `estadoRegistro` o las columnas de anulacion.
- [ ] Los importes se manejan con aritmetica decimal y viajan como cadena en la API.

#### Contratos y validacion

- [ ] Los esquemas Zod nuevos o modificados viven en `@cotizador/shared` y los usan los dos lados.
- [ ] No se introdujeron DTO de NestJS ni class-validator.
- [ ] Los tipos se derivan del esquema; no hay un tipo declarado en paralelo que pueda divergir.

#### Estructura

- [ ] El grafo de dependencias entre paquetes se respeta: `apps/web` no importa `@cotizador/database` y
      ningun paquete importa una aplicacion. Ver `decisions/0010-monorepo-y-paquetes.md`.
- [ ] La logica de negocio esta en el servicio, no en el controlador ni en el componente.
- [ ] Las reglas puras estan en `*.rules.ts` o en `@cotizador/shared`, y tienen prueba unitaria.

#### Base de datos

- [ ] Si cambio el modelo, hay una migracion generada, revisada y reversible.
- [ ] No se activo `synchronize` en ningun entorno.
- [ ] Los indices de tablas con volumen empiezan por `organizacionId`.

#### Calidad

- [ ] `pnpm typecheck`, `pnpm lint` y `pnpm test` pasan.
- [ ] No quedan `console.log` de depuracion ni `any` sin justificacion escrita.
- [ ] No hay secretos ni datos reales de clientes en el codigo ni en las pruebas.
- [ ] La documentacion afectada se actualizo en esta misma peticion de integracion.

## Scripts de calidad

Se ejecutan desde la raiz del monorepo y abarcan los cuatro paquetes.

| Script | Que hace | Cuando |
|--------|----------|--------|
| `pnpm typecheck` | Comprueba los tipos de `shared`, `database`, `api` y `web` sin emitir salida | Antes de cada peticion de integracion |
| `pnpm lint` | ESLint sobre `apps/web` | Antes de cada peticion de integracion |
| `pnpm format` | Prettier en modo escritura sobre `apps/**` y `packages/**` | Antes de commitear |
| `pnpm test` | Vitest sobre las reglas puras y el motor de precios | Antes de cada peticion de integracion |

```bash
pnpm typecheck && pnpm lint && pnpm test
```

Los tres deben pasar en local. La comprobacion en el servidor de integracion es una red de seguridad,
no el lugar donde se descubre que algo esta roto.

### Prettier

Configurado una sola vez en la raiz, en `prettier.config.mjs`, y aplicado a los cuatro paquetes.

| Opcion | Valor |
|--------|-------|
| `semi` | `true` |
| `singleQuote` | `true` |
| `trailingComma` | `'all'` |
| `printWidth` | `100` |

El formato no se discute en la revision de codigo. Si algo esta mal formateado, se ejecuta
`pnpm format`.

### ESLint

ESLint 9 con configuracion plana (`eslint.config.mjs`) y `eslint-config-next`, **solo en `apps/web`**.
El backend y los paquetes internos no llevan ESLint: su correccion la garantizan TypeScript en modo
estricto y las reglas de este documento, y agregar un segundo analizador aportaria mas ruido que
hallazgos.

Reglas de fondo, verificadas en la revision cuando el analizador no las cubre:

- `strict: true` en TypeScript, sin excepciones por paquete.
- `any` solo con un comentario en el mismo archivo que explique por que no hay alternativa.
- Sin `console.log` en el codigo final; en el servidor se usa el registro de eventos controlado.
- Sin marcas `TODO` vagas. Una marca pendiente debe nombrar la decision que falta y el documento donde
  se tomara.
- Sin imports relativos profundos: se usan los alias declarados en `docs/11-arquitectura-monorepo.md`.

### Pruebas

Vitest cubre lo que debe ser exacto y no depende de infraestructura:

| Que se prueba | Donde vive |
|---------------|------------|
| Motor de precios, con los casos de tabla obligatorios de `decisions/0005-motor-de-precios.md` | `packages/shared/src/precios` |
| Normalizacion de texto y equivalencias de medidas | `packages/shared/src/texto` |
| Evaluacion de permisos con comodin | `packages/shared/src/permissions` |
| Reglas puras de cada modulo, en `*.rules.ts` | `apps/api` |

Ninguna prueba del motor de precios puede requerir base de datos, red ni contenedor.

Aparte de las unitarias, cada modulo con datos de organizacion debe tener la prueba de aislamiento
descrita en `decisions/0001-multi-tenancy-por-organizacion.md`: un usuario de la organizacion A intenta
leer y modificar un registro de la organizacion B y recibe no encontrado. Esa prueba es condicion de
cierre de la especificacion, no un extra.

## Cierre de una especificacion

El proyecto sigue desarrollo guiado por especificacion. Una funcionalidad empieza por un documento en
`docs/specs/` y termina cuando ese documento refleja lo que se construyo.

Una especificacion se cierra cuando:

1. Todos sus criterios de aceptacion se cumplen y se verificaron de forma manual o automatica.
2. La prueba de aislamiento entre organizaciones del modulo existe y pasa.
3. El documento de la especificacion incorpora una seccion final de implementacion que registra:
   - los endpoints reales expuestos, con su codigo de permiso;
   - las entidades y migraciones creadas;
   - los esquemas Zod y los codigos de error agregados a `@cotizador/shared`;
   - las decisiones que se tomaron durante la implementacion y que no estaban previstas;
   - las desviaciones respecto de lo especificado, con su motivo.
4. Si alguna de esas decisiones es de arquitectura, existe un ADR nuevo que la recoge.

Una especificacion sin esa seccion de implementacion no esta cerrada, aunque el codigo funcione. El
proposito es que la especificacion siga siendo la descripcion vigente del sistema y no una foto de lo
que se penso antes de empezar.

## Documentos relacionados

- `docs/11-arquitectura-monorepo.md` — estructura del repositorio y alias de import.
- `docs/12-infraestructura-docker.md` — entorno de ejecucion y variables.
- `decisions/0001-multi-tenancy-por-organizacion.md` — la regla que protege el primer punto del
  checklist.
- `decisions/0003-pipeline-precotizacion.md` — la regla que protege el segundo.
- `decisions/0011-auditoria-y-trazabilidad.md` — que se registra y que no se borra nunca.
