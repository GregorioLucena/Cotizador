# ADR 0010: Monorepo con pnpm workspaces y cuatro paquetes

## Estado

Aceptada — 2026-09-17

## Contexto

El producto se compone de dos aplicaciones que se despliegan por separado: una API que concentra la
logica de negocio y una interfaz web que la consume. Entre ellas existe una cantidad grande de
conocimiento compartido que **no puede divergir**:

- Los esquemas Zod de cada contrato de la API, que el navegador usa para validar formularios y el
  servidor para rechazar peticiones.
- El motor de precios, que segun `decisions/0005-motor-de-precios.md` debe ejecutarse en el servidor
  para persistir y en el navegador para recalcular mientras el operador edita.
- Los codigos de permiso en formato `modulo.recurso.accion`, que el servidor evalua y la interfaz usa
  para decidir que mostrar.
- Los codigos de error, que el servidor emite y la interfaz traduce a mensajes.
- La funcion de normalizacion de texto, que segun `decisions/0007-estrategia-de-matching.md` debe ser
  identica al normalizar la solicitud y al construir la columna de texto de busqueda.

Ademas las entidades TypeORM, las migraciones y las semillas por vertical son un artefacto propio: los
usa la API en tiempo de ejecucion, pero tambien el comando de migraciones, el comando de semilla y el
entrypoint de los contenedores, que no arrancan NestJS.

La pregunta que este ADR resuelve no es si usar un monorepo, sino **cuantos paquetes hay, quien puede
importar a quien y por que**.

## Decision

Se adopta un **monorepo unico gestionado con pnpm workspaces**, con dos aplicaciones y dos paquetes
internos, y un grafo de dependencias declarado y verificable.

### Estructura

```text
cotizador/
├── apps/
│   ├── api/        @cotizador/api        NestJS
│   └── web/        @cotizador/web        Next.js
├── packages/
│   ├── database/   @cotizador/database   entidades, migraciones, semillas
│   └── shared/     @cotizador/shared     esquemas, tipos, permisos, errores, precios, texto
├── pnpm-workspace.yaml
└── package.json
```

`pnpm-workspace.yaml` declara los dos patrones:

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

Las dependencias internas se declaran con el protocolo `workspace:*`, de modo que pnpm enlaza el
paquete local y nunca intenta resolverlo contra un registro remoto:

```json
{
  "dependencies": {
    "@cotizador/shared": "workspace:*",
    "@cotizador/database": "workspace:*"
  }
}
```

`.npmrc` fija `node-linker=hoisted`, necesario para que los decoradores de TypeORM y la carga de
entidades funcionen dentro de los contenedores sin sorpresas de resolucion de modulos.

### Grafo de dependencias permitido

| Paquete | Puede depender de | No puede depender de |
|---------|-------------------|----------------------|
| `apps/web` | `@cotizador/shared` | `@cotizador/database`, `apps/api` |
| `apps/api` | `@cotizador/shared`, `@cotizador/database` | `apps/web` |
| `@cotizador/database` | `@cotizador/shared` | `apps/api`, `apps/web` |
| `@cotizador/shared` | Nada del proyecto | Todo lo demas |

Representado como grafo:

```text
        @cotizador/shared
         ^      ^       ^
         |      |       |
         |      |       +----------------+
         |      |                        |
   apps/web   @cotizador/database <---- apps/api
```

El grafo es aciclico y tiene una unica hoja. `@cotizador/shared` no depende de ningun otro paquete del
proyecto y esa es la propiedad que lo hace utilizable desde los dos lados.

### Prohibiciones explicitas

1. **`apps/web` no puede importar `@cotizador/database`.** Ni entidades, ni enumerados de entidad, ni
   el origen de datos. Importar una entidad arrastra TypeORM y `reflect-metadata` al paquete del
   navegador, expone la forma de las tablas al cliente y crea la tentacion de consultar la base de
   datos desde una ruta de servidor de Next.js, saltandose los guards que garantizan el aislamiento por
   organizacion de `decisions/0001-multi-tenancy-por-organizacion.md`. La web habla con la API por HTTP
   y con nada mas.
2. **Ningun paquete de `packages/` puede importar nada de `apps/`.** La direccion de la dependencia es
   siempre de aplicacion hacia paquete. Si un paquete necesita algo que vive en una aplicacion, es
   señal de que ese codigo esta en el lugar equivocado.
3. **`@cotizador/shared` no puede importar `@cotizador/database`.** Si un esquema Zod necesita un
   enumerado que tambien usa una entidad, el enumerado se define en `shared` y la entidad lo importa
   desde ahi, nunca al reves.
4. **`@cotizador/shared` no puede hacer entrada ni salida.** Sin acceso a base de datos, sin peticiones
   de red, sin lectura de archivos, sin `process.env` y sin lectura del reloj del sistema. Las fechas
   se reciben como parametro. Es lo que permite ejecutarlo en el navegador y probarlo sin
   infraestructura.
5. **`@cotizador/database` no contiene logica de negocio.** Contiene entidades, migraciones, semillas y
   la configuracion del origen de datos. Las reglas viven en los servicios de `apps/api` o, si son
   puras, en `@cotizador/shared`.

Estas reglas se verifican en la revision de codigo y se declaran de forma ejecutable: un paquete solo
puede importar lo que figura en sus `dependencies`, de modo que un import prohibido falla al compilar
en lugar de pasar inadvertido.

### Por que el motor de precios vive en `shared`

El motor de precios es la pieza que mas fuerza la existencia de un paquete compartido, porque tiene un
requisito que ningun otro componente tiene: **la misma funcion debe ejecutarse en dos entornos
distintos y producir exactamente el mismo resultado**.

| Lado | Cuando se ejecuta | Para que |
|------|-------------------|----------|
| Navegador | En cada edicion del borrador: cambiar cantidad, elegir otro item, sobrescribir un precio | Mostrar el total actualizado sin esperar un viaje al servidor, para que el operador trabaje sin friccion |
| Servidor | Al generar el borrador y al aprobar la cotizacion | Persistir los importes y congelar precio, descuento, regla aplicada, impuesto y tasa |

Si existieran dos implementaciones, la interfaz podria mostrar un total y el servidor persistir otro. El
operador aprobaria un numero y el cliente recibiria otro. Ese defecto seria intermitente, dificil de
reproducir y directamente costoso en dinero. La unica defensa estructural es que haya una sola
implementacion, y para que haya una sola tiene que vivir donde los dos lados pueden importarla.

El mismo razonamiento aplica a los esquemas Zod. El formulario de alta de item valida contra el mismo
objeto con el que el controlador rechaza la peticion; el editor de plantilla de documento valida contra
el `plantillaDocumentoConfigSchema` de `decisions/0006-plantillas-de-documento.md`, que es el mismo que
usa el renderizador. Un campo agregado al esquema rompe la compilacion de ambos lados a la vez, que es
justamente el comportamiento que se busca.

Y aplica a la normalizacion de texto: `decisions/0007-estrategia-de-matching.md` establece que la misma
funcion pura normaliza el texto de la solicitud y el texto que se indexa, y que si divergen la busqueda
falla de forma silenciosa. Colocarla en `shared` hace que la divergencia sea imposible por
construccion.

### Contenido de cada paquete interno

| Paquete | Contiene | No contiene |
|---------|----------|-------------|
| `@cotizador/shared` | Esquemas Zod, tipos derivados, catalogo de permisos, catalogo de errores, motor de precios, normalizacion de texto | Entrada y salida, framework, dependencias de Node exclusivas |
| `@cotizador/database` | Entidades TypeORM, enumerados de persistencia, origen de datos, migraciones, semillas de plataforma y packs de vertical | Reglas de negocio, controladores, servicios de aplicacion |

Ambos compilan a `dist/` y se consumen desde los `exports` declarados en su `package.json`, no mediante
alias de TypeScript hacia los archivos fuente. Asi la aplicacion consume el paquete igual que lo haria
si estuviera publicado, y el empaquetado en produccion es el mismo que en desarrollo.

## Alternativas descartadas

### Repositorios separados para backend y frontend

**Pros:** cada repositorio con su ciclo de versiones, sus permisos y su tuberia de integracion; historia
de cambios mas acotada; posible separacion de equipos.
**Contras:** el codigo compartido tendria que publicarse como paquete o duplicarse. Un cambio que toca
un contrato, que es el caso mas frecuente en este producto, se convertiria en tres peticiones de
integracion coordinadas en dos repositorios, con una ventana en la que las versiones no coinciden. El
motor de precios quedaria duplicado o versionado, con el riesgo de que el navegador ejecute una version
y el servidor otra, que es exactamente el defecto que este diseño quiere hacer imposible. Ademas
levantar el entorno local exigiria clonar y sincronizar dos repositorios.
**Descartada.** El grado de acoplamiento entre las dos aplicaciones es alto por diseño y un repositorio
unico lo refleja con honestidad.

### Turborepo o Nx como orquestador de tareas

**Pros:** cache de tareas local y remota, ejecucion segun el grafo de dependencias, deteccion de los
paquetes afectados por un cambio, generadores de codigo.
**Contras:** son herramientas cuyo valor crece con el numero de paquetes y con el tiempo de
compilacion. Aqui hay **cuatro paquetes** y un grafo de dos niveles que se resuelve con dos comandos en
orden: compilar `shared`, compilar `database`, y despues las aplicaciones. `pnpm --filter` con un script
`build:packages` cubre el caso completo. Adoptar un orquestador agregaria un archivo de configuracion
adicional, un modelo mental adicional, una dependencia adicional que actualizar y una capa de cache que
depurar cuando un artefacto queda obsoleto, sin ahorrar tiempo medible en un proyecto de este tamaño.
**Descartada por ahora.** La decision es reversible sin coste: la estructura de workspaces de pnpm es
precisamente la entrada que esperan ambas herramientas, de modo que se pueden adoptar mas adelante sin
mover un solo archivo. El criterio para reconsiderarlo es que la compilacion completa supere unos pocos
minutos o que el numero de paquetes crezca de forma significativa.

### Copiar los tipos a mano entre backend y frontend

**Pros:** cero infraestructura, cero configuracion, cada aplicacion es autonoma.
**Contras:** es la duplicacion sin ninguna red de seguridad. Nada avisa cuando las copias divergen: la
compilacion pasa en los dos lados porque cada uno es coherente consigo mismo, y el defecto aparece en
produccion como un campo que el servidor ignora o una validacion que el formulario no hace. En un
producto cuyo valor central es que los importes sean exactos y auditables, es la peor opcion posible.
**Descartada** sin matices.

### Publicar `shared` y `database` en un registro privado

**Pros:** limite explicito entre paquetes, versionado semantico real, posibilidad de que consumidores
externos futuros usen los mismos contratos.
**Contras:** cada cambio de contrato requiere publicar una version, actualizar la dependencia en los
consumidores e integrar los cambios en varias peticiones; para cambiar una linea del motor de precios
habria que publicar y esperar. Ademas exige mantener un registro privado, sus credenciales y su gestion
de accesos en la maquina de cada persona, en Docker y en la integracion continua. Todo eso para
resolver un problema que no existe: hoy hay exactamente dos consumidores y estan en este repositorio.
**Descartada.** `workspace:*` da el limite entre paquetes sin la burocracia. Si algun dia existe un
consumidor externo real, como una aplicacion movil que quiera reutilizar los esquemas, se publicara
`shared` en ese momento; su ausencia de dependencias lo hace trivialmente publicable.

### Un unico paquete con todo el codigo, sin `packages/`

**Pros:** la configuracion mas simple, sin compilacion previa de paquetes internos ni pasos de
enlazado.
**Contras:** desaparece la frontera que impide que la web importe entidades de base de datos. La regla
"la web no habla con la base de datos" pasaria de ser una restriccion verificable al compilar a ser una
convencion que depende de que nadie se equivoque. Tambien haria mas dificil empaquetar el frontend, que
arrastraria dependencias de servidor.
**Descartada.** El limite entre paquetes es el mecanismo que hace cumplir la arquitectura.

## Consecuencias

- Un cambio de contrato se hace en un unico lugar, en una unica peticion de integracion, y la
  compilacion de los cuatro paquetes verifica que todos los consumidores se actualizaron.
- Los paquetes internos deben compilarse antes de arrancar las aplicaciones. Los scripts de desarrollo
  lo hacen de forma automatica; en Docker lo hace el entrypoint, segun
  `docs/12-infraestructura-docker.md`.
- La instalacion de dependencias es unica desde la raiz con `pnpm install`, y `pnpm-lock.yaml` se
  versiona siempre para que las imagenes de contenedor sean reproducibles.
- La historia de cambios del repositorio mezcla backend, frontend y documentacion. Es intencional: una
  funcionalidad se lee completa en un solo lugar.
- Un cambio en `@cotizador/shared` obliga a verificar los dos consumidores. Es el precio de tener una
  sola definicion, y es un precio que se paga al compilar y no en produccion.
- La documentacion del producto vive en el mismo repositorio que el codigo, lo que permite exigir que
  una peticion de integracion actualice ambos a la vez, tal como establece
  `docs/10-convenciones-git-y-calidad.md`.
- El aislamiento por organizacion sigue siendo responsabilidad de los servicios de `apps/api`. El
  monorepo no lo garantiza, pero si garantiza que no exista un segundo camino de acceso a los datos.

## Referencias

- `docs/11-arquitectura-monorepo.md`
- `docs/12-infraestructura-docker.md`
- `docs/10-convenciones-git-y-calidad.md`
- `decisions/0005-motor-de-precios.md`
- `decisions/0007-estrategia-de-matching.md`
- `decisions/0009-stack-tecnologico.md`
