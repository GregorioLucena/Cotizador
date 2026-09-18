# ADR 0012: Infraestructura con Docker y tres entornos

## Estado

Aceptada — 2026-09-17

## Contexto

El producto necesita PostgreSQL 16 con las extensiones `pg_trgm` y `unaccent`, Node 22, y un navegador
sin interfaz grafica para generar el PDF. Esas tres dependencias tienen que estar disponibles de la
misma forma en la maquina de cada persona que desarrolla, en el entorno donde se valida y en
produccion, porque las diferencias entre entornos son la fuente habitual del defecto que solo aparece
al desplegar.

Al mismo tiempo el ciclo de trabajo diario no puede volverse lento. Reconstruir una imagen para ver el
efecto de cambiar una linea de un servicio es un impuesto que se paga decenas de veces al dia.

Hay ademas un requisito derivado de `decisions/0009-stack-tecnologico.md`: el esquema se gestiona con
migraciones explicitas y `synchronize: false`. Eso significa que **arrancar la aplicacion no crea las
tablas**. Alguien tiene que ejecutar las migraciones, y ese paso debe ser automatico y anterior al
arranque en los entornos donde no hay una persona mirando.

## Decision

Se adopta Docker como unica dependencia de infraestructura, con **tres entornos declarados** y una
estrategia distinta para el entorno de desarrollo que para los demas.

### Los tres entornos

| Entorno | Base de datos | Aplicaciones | Archivo de compose | Proposito |
|---------|---------------|--------------|--------------------|-----------|
| `development` | Contenedor | En la maquina local con pnpm | `docker-compose.dev.yml` | Trabajo diario, iteracion rapida |
| `testing` | Contenedor | Contenedor | `docker-compose.yml` | Validacion e integracion antes de produccion |
| `production` | Contenedor | Contenedor | `docker-compose.yml` | Servicio real |

`testing` y `production` comparten archivo de compose y se diferencian por el archivo de variables de
entorno y por el valor de `NODE_ENV`. Construir la misma imagen y desplegarla con configuracion distinta
es precisamente lo que garantiza que lo validado sea lo que se publica.

### Desarrollo: solo PostgreSQL en Docker por defecto

El comportamiento predeterminado de `pnpm dev` es levantar **unicamente el contenedor de PostgreSQL** y
ejecutar la API y la web en la maquina local con pnpm.

Motivos:

1. El recargado en caliente de Next.js con Turbopack y el modo observador de NestJS funcionan mas rapido
   y con menos sorpresas fuera de un contenedor. Dentro hace falta sondeo del sistema de archivos, que
   consume procesador de forma continua.
2. El depurador del editor se conecta al proceso local sin configuracion adicional.
3. Un monorepo con pnpm montado como volumen obliga a manejar volumenes separados para
   `node_modules` y para los directorios de compilacion, porque los enlaces simbolicos creados en la
   maquina anfitriona no son validos dentro del contenedor. Es una fuente constante de perdida de
   tiempo.
4. Lo unico que realmente necesita ser identico entre entornos es PostgreSQL con sus extensiones y su
   version. Node se fija con la misma version mayor en ambos lados.

El stack completo en contenedores sigue disponible en el mismo archivo mediante un **perfil de
compose**, para reproducir un problema que solo ocurre dentro de contenedores o para verificar el
entrypoint antes de desplegar:

```bash
# Por defecto: solo la base de datos
docker compose --env-file .env.development -f docker-compose.dev.yml up -d postgres

# Stack completo con el perfil
docker compose --env-file .env.development -f docker-compose.dev.yml --profile full up --build
```

Los servicios `api` y `web` de `docker-compose.dev.yml` declaran `profiles: [full]`, de modo que no
arrancan salvo que se pidan de forma explicita.

### Imagenes multi etapa sobre node:22-alpine

Cada aplicacion tiene su propio `Dockerfile` con al menos tres etapas:

| Etapa | Que hace |
|-------|----------|
| `deps` | Copia los manifiestos y el lockfile, ejecuta `pnpm install --frozen-lockfile` |
| `build` | Copia el codigo, compila los paquetes internos y luego la aplicacion |
| `runner` | Imagen final con Node 22 alpine, solo artefactos compilados y dependencias de produccion |

Reglas:

- El contexto de construccion es la **raiz del monorepo**, porque el workspace de pnpm lo necesita.
- Se activa Corepack y se usa exclusivamente pnpm.
- Los manifiestos y el lockfile se copian antes que el codigo, para que la capa de instalacion se
  reutilice mientras no cambien las dependencias.
- La imagen final ejecuta con un usuario sin privilegios.
- Ninguna variable sensible se incorpora a la imagen; todas llegan por entorno al arrancar.
- Las imagenes no se versionan en el repositorio; los `Dockerfile` si.

En desarrollo existe ademas un `Dockerfile.dev` unico y compartido por ambas aplicaciones, sin
optimizacion de tamaño, pensado solo para velocidad de iteracion.

### Chromium en la imagen de la API

`decisions/0006-plantillas-de-documento.md` establece que el PDF se produce con un navegador sin
interfaz grafica detras de la interfaz `GeneradorPdf`. Por lo tanto la imagen de la API instala chromium
desde los paquetes de Alpine junto con sus fuentes y bibliotecas de apoyo, y **no** descarga el
navegador que algunas bibliotecas traen por su cuenta: el binario del sistema es el que se usa, indicado
por una variable declarada en la propia imagen.

Consecuencias asumidas:

- La imagen de la API es sensiblemente mas grande que la de la web.
- El contenedor necesita mas memoria durante la generacion, y el proceso del navegador debe cerrarse
  siempre, tambien cuando la generacion falla.
- Existe un tiempo limite de generacion, `PDF_TIMEOUT_MS`, pasado el cual se aborta y se informa el
  error sin dejar procesos huerfanos.
- La web no necesita chromium; su imagen no lo instala.

### Migraciones en el entrypoint

El entrypoint de la API en contenedor ejecuta una secuencia fija antes de arrancar el proceso:

```text
1. Esperar a que PostgreSQL responda (healthcheck del servicio y espera activa en el script)
2. Ejecutar las migraciones pendientes
3. Si RUN_SEED es verdadero, ejecutar la semilla
4. Arrancar la API
```

Reglas:

1. **Si las migraciones fallan, el contenedor no arranca.** El script termina con codigo de error. Una
   aplicacion corriendo contra un esquema incompleto produce errores intermitentes y confusos; un
   contenedor que no levanta produce un mensaje claro en el primer intento.
2. Las migraciones se ejecutan siempre en el arranque de `testing` y `production`. Son idempotentes por
   definicion: TypeORM aplica solo las pendientes segun su tabla de control.
3. En desarrollo local las migraciones **no** se ejecutan de forma automatica. Se lanzan a mano con
   `pnpm db:migrate`, porque durante el desarrollo se generan, revierten y regeneran con frecuencia y
   un paso automatico estorba.
4. La primera migracion crea las extensiones `pg_trgm` y `unaccent`, requisito de
   `decisions/0007-estrategia-de-matching.md`.
5. Con varias replicas de la API, las migraciones las ejecuta una sola instancia. Mientras haya una
   unica replica el propio entrypoint basta; cuando deje de haberla, se extrae a un trabajo de
   despliegue previo.

### Semilla condicional con `RUN_SEED`

La semilla se ejecuta solo si `RUN_SEED` vale `true`. El valor por defecto depende del entorno:

| Entorno | Valor | Motivo |
|---------|-------|--------|
| `development` | `true` | Se quiere una base utilizable en cada arranque limpio |
| `testing` | `true` | Se quiere un conjunto de datos conocido para validar |
| `production` | `false` | Una semilla que se ejecuta sola en produccion es un riesgo, no una comodidad |

La semilla es **idempotente**: comprueba antes de insertar y no duplica. Contiene los catalogos globales
de plataforma (monedas, perfiles, permisos, verticales) y, si se indica, el usuario administrador
inicial definido por `SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD`. Los packs de vertical descritos en
`decisions/0002-catalogo-generico-por-vertical.md` **no** son semilla de arranque: se materializan al
provisionar cada organizacion.

### Healthchecks y orden de arranque

| Servicio | Comprobacion | Efecto |
|----------|--------------|--------|
| `postgres` | `pg_isready` con el usuario configurado | `api` espera la condicion `service_healthy` |
| `api` | Peticion al endpoint de salud, que verifica la conexion a la base de datos | `web` espera a que la API este iniciada |
| `web` | Peticion a la raiz | Diagnostico y reinicio automatico |

El endpoint de salud de la API responde con el estado de la conexion a la base de datos y la version
desplegada. No revela datos de ninguna organizacion y no requiere autenticacion.

### Datos y red

- PostgreSQL persiste en un volumen con nombre. Borrarlo es una accion deliberada y explicita.
- El puerto de PostgreSQL se publica hacia la maquina anfitriona **solo en desarrollo**. En `testing` y
  `production` la base de datos es accesible unicamente desde la red interna de Docker.
- Cada entorno tiene su red bridge con nombre propio.
- `DATABASE_SSL` controla si la conexion exige cifrado, lo que permite usar una base de datos gestionada
  externa sin cambiar el codigo.

## Alternativas descartadas

### PostgreSQL instalado directamente en la maquina, sin Docker

**Pros:** un servicio menos que levantar, arranque instantaneo, menos consumo de recursos.
**Contras:** cada persona termina con una version distinta, y las extensiones `pg_trgm` y `unaccent` se
instalan de forma diferente en cada sistema operativo. El equipo trabaja en Windows, donde la
instalacion y la administracion de PostgreSQL nativo es incomoda. Ademas, tener varios proyectos en la
misma maquina obliga a compartir una instancia con bases de datos conviviendo, y borrar y recrear la
base de datos deja de ser una operacion trivial.
**Descartada.** Docker para la base de datos cuesta un comando y elimina toda una categoria de
diferencias entre entornos. No se descarta que alguien apunte `DATABASE_URL` a una instancia propia: el
diseño no lo impide, simplemente no es el camino documentado.

### Todo en contenedores tambien en desarrollo, como unica opcion

**Pros:** un unico modo de ejecutar el producto, maxima paridad con produccion, no hace falta Node
instalado en la maquina.
**Contras:** el recargado en caliente exige sondeo del sistema de archivos y consume procesador de forma
continua; los enlaces simbolicos de pnpm creados en la maquina anfitriona no son validos dentro del
contenedor, lo que obliga a volumenes separados para `node_modules` y para los directorios de
compilacion; conectar el depurador requiere configuracion adicional; y cada cambio de dependencias
implica reconstruir.
**Descartada como modo por defecto.** Se conserva como perfil opcional del mismo archivo de compose,
porque sigue siendo la forma correcta de reproducir un problema especifico de contenedores.

### Kubernetes desde el inicio

**Pros:** escalado horizontal, despliegues progresivos, reinicio y recuperacion automaticos, estandar de
la industria para operar servicios.
**Contras:** introduce manifiestos, un registro de imagenes, gestion de secretos, ingreso y observacion
antes de tener un solo cliente en produccion. El producto arranca con un piloto de pocas organizaciones
y decenas de cotizaciones diarias, un volumen que atiende de sobra una sola maquina con Docker Compose.
La complejidad operativa recaeria sobre el mismo equipo pequeño que construye el producto.
**Descartada para esta fase.** La decision es de bajo costo de reversion: las aplicaciones ya son
contenedores sin estado con toda su configuracion por entorno, que es el requisito real para migrar.
El criterio para reconsiderarlo es necesitar mas de una replica de la API o despliegues sin
interrupcion.

### Servicio externo de generacion de PDF

**Pros:** la imagen de la API queda pequeña y sin chromium, no hay que administrar memoria de un
navegador, escalado independiente.
**Contras:** el documento de cotizacion contiene precios, clientes y datos fiscales de la organizacion;
enviarlo a un tercero introduce una exposicion que hay que justificar ante cada cliente. Añade costo por
documento, latencia de red y una dependencia externa sin acuerdo de servicio en un camino que el usuario
espera en pantalla. Ademas la vista previa de la plantilla, que segun
`decisions/0006-plantillas-de-documento.md` debe usar el mismo renderizado que la generacion final,
pasaria tambien por el servicio externo.
**Descartada.**

### Servicio propio separado dedicado a generar PDF

Se evaluo un tercer contenedor con chromium que la API invoque por HTTP.

**Pros:** aisla el consumo de memoria del navegador del proceso que atiende las peticiones; permite
escalar o reiniciar la generacion sin afectar a la API; la imagen de la API vuelve a ser pequeña.
**Contras:** agrega un servicio mas que desplegar, vigilar y versionar, junto con un contrato interno
entre ambos, para un volumen de generacion que en el piloto es de unos pocos documentos por hora.
**Descartada para esta fase, y anotada como evolucion prevista.** Si el consumo de memoria del navegador
sin interfaz resulta molesto en el contenedor de la API, extraerlo es el siguiente paso natural y no
requiere cambios de dominio: la interfaz `GeneradorPdf` ya existe justamente para eso, y la
implementacion actual se sustituiria por una que llama al servicio por HTTP. Este ADR deja el camino
declarado para no tener que rediscutirlo.

### Un unico archivo de compose para los tres entornos

**Pros:** un solo archivo que mantener.
**Contras:** desarrollo y produccion tienen necesidades opuestas: uno monta el codigo como volumen y
publica el puerto de la base de datos, el otro no debe hacer ninguna de las dos cosas. Mezclarlos en un
archivo con condicionales produce un archivo que nadie entiende y en el que es facil publicar por error
la base de datos de produccion.
**Descartada.** Dos archivos: `docker-compose.dev.yml` y `docker-compose.yml`.

## Consecuencias

- La unica dependencia previa para trabajar en el proyecto es Docker, Node 22 y Corepack. Con eso,
  `pnpm install` y `pnpm dev` bastan.
- El esquema de la base de datos solo cambia con migraciones revisadas. Nadie puede modificarlo por
  accidente al arrancar la aplicacion.
- Un despliegue fallido por una migracion invalida se detecta en el arranque, no mas tarde con errores
  de consulta.
- La imagen de la API es pesada por chromium y su consumo de memoria hay que vigilarlo. Existe un plan
  de extraccion declarado si el problema se materializa.
- `pnpm dev` depende de que Docker este corriendo. Si no lo esta, el fallo debe ser un mensaje claro y
  no un error de conexion a la base de datos.
- El puerto de PostgreSQL expuesto en desarrollo permite conectar herramientas graficas de inspeccion,
  lo que es util para depurar migraciones y consultas de similitud.
- Los detalles concretos de servicios, variables y comandos viven en `docs/12-infraestructura-docker.md`
  y no en este ADR, que fija solo las decisiones.

## Referencias

- `docs/12-infraestructura-docker.md`
- `docs/11-arquitectura-monorepo.md`
- `decisions/0006-plantillas-de-documento.md`
- `decisions/0007-estrategia-de-matching.md`
- `decisions/0009-stack-tecnologico.md`
- `decisions/0010-monorepo-y-paquetes.md`
