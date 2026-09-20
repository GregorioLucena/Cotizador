# Infraestructura Docker

Este documento describe la infraestructura concreta del producto: variables de entorno, servicios de
Docker Compose, imagenes, entrypoints, orden de arranque y puesta en marcha local. Las decisiones que lo
sustentan estan en `decisions/0012-infraestructura-y-entornos.md`. La estructura del repositorio esta en
`docs/11-arquitectura-monorepo.md`.

## Requisitos previos

| Herramienta | Version | Para que |
|-------------|---------|----------|
| Docker Desktop o Docker Engine | Con Compose v2 | PostgreSQL y, opcionalmente, el stack completo |
| Node.js | 22 | Ejecutar la API y la web en la maquina local |
| Corepack | Incluido en Node 22 | Activar pnpm 9.15.9 con la version del proyecto |
| Git | Cualquiera reciente | Clonar el repositorio |

No hace falta instalar PostgreSQL ni chromium en la maquina: el primero corre en contenedor y el segundo
solo se necesita dentro de la imagen de la API.

## Variables de entorno

Todas las variables viven en un unico archivo en la raiz del monorepo. La plantilla
`.env.development.example` se versiona; el archivo `.env.development` con los valores reales **no** se
versiona.

Los scripts de la raiz cargan ese archivo con `dotenv-cli`; los contenedores lo reciben con
`--env-file`.

### Base de datos

| Variable | Descripcion | Ejemplo |
|----------|-------------|---------|
| `POSTGRES_USER` | Usuario que crea la imagen de PostgreSQL al inicializar el volumen | `cotizador` |
| `POSTGRES_PASSWORD` | Contraseña de ese usuario. En produccion se genera y se custodia fuera del repositorio | `cambiar-en-produccion` |
| `POSTGRES_DB` | Nombre de la base de datos que se crea al inicializar | `cotizador` |
| `DATABASE_URL` | Cadena de conexion completa que usa TypeORM. En desarrollo apunta a `localhost`; dentro de la red de Docker el servicio `api` la sobrescribe a `postgres` | `postgresql://cotizador:cambiar-en-produccion@localhost:5432/cotizador` |
| `DATABASE_SSL` | Exige conexion cifrada. `false` en desarrollo; `true` al usar una base de datos gestionada externa | `false` |

### Autenticacion y sesion

| Variable | Descripcion | Ejemplo |
|----------|-------------|---------|
| `JWT_SECRET` | Clave de firma del token de acceso. Debe ser distinta en cada entorno y generarse con un generador criptografico | `generar-con-openssl-rand-hex-32` |
| `JWT_ACCESS_EXPIRES_IN` | Vigencia del token de acceso. Corta a proposito: la sesion se sostiene con el token de refresco | `15m` |
| `JWT_REFRESH_EXPIRES_DAYS` | Vigencia en dias del token de refresco guardado en cookie `httpOnly` | `7` |
| `COOKIE_SAMESITE` | Politica de la cookie de refresco. `lax` cuando la web y la API comparten dominio; `none` con dominios distintos, y entonces exige HTTPS | `lax` |

### API

| Variable | Descripcion | Ejemplo |
|----------|-------------|---------|
| `API_PORT` | Puerto que el contenedor de la API publica en la maquina anfitriona | `3001` |
| `PORT` | Puerto en el que escucha el proceso de NestJS dentro del contenedor | `3001` |
| `CORS_ORIGIN` | Origen permitido para las peticiones del navegador. Lista separada por comas si hay varios | `http://localhost:3000` |
| `NODE_ENV` | Entorno de ejecucion: `development`, `test` o `production` | `development` |

### Web

| Variable | Descripcion | Ejemplo |
|----------|-------------|---------|
| `WEB_PORT` | Puerto que el contenedor de la web publica en la maquina anfitriona | `3000` |
| `NEXT_PUBLIC_API_URL` | Direccion de la API tal como la ve el navegador. Se incorpora al paquete del cliente al compilar, por lo que no puede contener secretos | `http://localhost:3001/api` |

### Proveedor de inteligencia artificial

Ver `decisions/0004-proveedor-de-ia-abstraido.md`.

| Variable | Descripcion | Ejemplo |
|----------|-------------|---------|
| `IA_PROVEEDOR` | Implementacion activa: `none` fuerza el modo manual, `openai` usa el servicio remoto, `ollama` un modelo local, `mock` respuestas fijas para pruebas | `none` |
| `IA_MODELO` | Identificador del modelo que usa el proveedor seleccionado. Se persiste en cada interpretacion | `gpt-4o-mini` |
| `IA_TIMEOUT_MS` | Tiempo limite de la llamada al proveedor. Al expirar, la etapa falla de forma controlada y el borrador se crea vacio | `20000` |
| `IA_MAX_CARACTERES` | Longitud maxima del texto del cliente que se envia al proveedor, para acotar costo y evitar abuso | `4000` |
| `OPENAI_API_KEY` | Credencial del servicio remoto. Solo se define cuando `IA_PROVEEDOR` es `openai` | `sk-...` |
| `IA_TEMPERATURA` | Temperatura del modelo (extraccion: preferir 0) | `0` |
| `IA_COSTO_ENTRADA_POR_1K` | USD estimado por 1000 tokens de entrada | `0.00015` |
| `IA_COSTO_SALIDA_POR_1K` | USD estimado por 1000 tokens de salida | `0.0006` |
| `OLLAMA_BASE_URL` | Direccion del servidor local de modelos. Desde un contenedor se usa `host.docker.internal` | `http://localhost:11434` |

### Documentos y archivos

| Variable | Descripcion | Ejemplo |
|----------|-------------|---------|
| `PDF_TIMEOUT_MS` | Tiempo limite de la generacion de un PDF con el navegador sin interfaz. Al expirar se aborta y se cierra el proceso del navegador | `30000` |
| `ALMACENAMIENTO_ARCHIVOS` | Destino de los documentos generados y los logotipos: `local` guarda en un volumen del contenedor, `s3` en un almacenamiento compatible con objetos | `local` |

### Semilla

| Variable | Descripcion | Ejemplo |
|----------|-------------|---------|
| `RUN_SEED` | Si vale `true`, el entrypoint ejecuta la semilla idempotente antes de arrancar. Debe ser `false` en produccion | `true` |
| `SEED_ADMIN_EMAIL` | Correo del usuario administrador de plataforma que crea la semilla si no existe | `admin@cotizador.local` |
| `SEED_ADMIN_PASSWORD` | Contraseña inicial de ese usuario. Se cambia en el primer inicio de sesion y nunca se versiona | `cambiar-en-el-primer-acceso` |

### Reglas sobre las variables

1. `.env.development` no se versiona nunca. `.env.development.example` si, y debe mantenerse sincronizado
   con las variables que el codigo lee de verdad.
2. Ninguna variable con valor sensible puede llevar el prefijo `NEXT_PUBLIC_`: todo lo que lo lleva viaja
   al navegador.
3. `JWT_SECRET`, `POSTGRES_PASSWORD`, `OPENAI_API_KEY` y `SEED_ADMIN_PASSWORD` tienen valores distintos
   en cada entorno.
4. Una variable nueva se agrega a la plantilla y a esta tabla en la misma peticion de integracion que el
   codigo que la usa.

## Servicios de Compose

### Archivos

| Archivo | Entornos | Contenido |
|---------|----------|-----------|
| `docker-compose.dev.yml` | `development` | PostgreSQL siempre; `api` y `web` solo con el perfil `full` |
| `docker-compose.yml` | `testing`, `production` | PostgreSQL, `api` y `web` a partir de imagenes construidas |

### postgres

| Campo | Valor |
|-------|-------|
| Imagen | `postgres:16-alpine` |
| Puerto publicado | `5432`, **solo en desarrollo** |
| Volumen | `postgres_data:/var/lib/postgresql/data` |
| Healthcheck | `pg_isready -U ${POSTGRES_USER}`, intervalo 5 segundos, 5 reintentos |
| Reinicio | `unless-stopped` |

Las extensiones `pg_trgm` y `unaccent` **no** se instalan con un script de inicializacion de la imagen:
las crea la primera migracion, para que la base de datos quede igual venga de donde venga. Ver
`decisions/0007-estrategia-de-matching.md`.

En `testing` y `production` el servicio no publica puerto. La base de datos solo es accesible desde la
red interna.

### api

| Campo | Valor |
|-------|-------|
| Imagen de desarrollo | `Dockerfile.dev`, contexto la raiz del monorepo |
| Imagen de produccion | `apps/api/Dockerfile`, multi etapa sobre `node:22-alpine` |
| Puerto publicado | `${API_PORT}` hacia el `3001` del contenedor |
| Depende de | `postgres` con condicion `service_healthy` |
| Entrypoint | `scripts/docker-entrypoint-api.sh` |
| Healthcheck | Peticion al endpoint de salud, que comprueba la conexion a la base de datos |
| Perfil en desarrollo | `full` |

Dentro de la red de Docker, el servicio sobrescribe `DATABASE_URL` para apuntar al nombre del servicio:

```yaml
environment:
  DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
  PORT: 3001
```

Esto es necesario porque `.env.development` contiene `localhost`, que es el valor correcto para el flujo
local y el incorrecto dentro de un contenedor.

### web

| Campo | Valor |
|-------|-------|
| Imagen de desarrollo | `Dockerfile.dev`, contexto la raiz del monorepo |
| Imagen de produccion | `apps/web/Dockerfile`, multi etapa sobre `node:22-alpine` |
| Puerto publicado | `${WEB_PORT}` hacia el `3000` del contenedor |
| Depende de | `api` |
| Perfil en desarrollo | `full` |

`NEXT_PUBLIC_API_URL` se resuelve en el navegador, no dentro de la red de Docker. Su valor siempre es la
direccion publica de la API, `http://localhost:3001/api` en desarrollo, y nunca `http://api:3001`.

### Volumenes y red

| Recurso | Uso |
|---------|-----|
| `postgres_data` | Datos de PostgreSQL. Borrarlo destruye la base de datos y es una accion deliberada |
| `archivos_generados` | Documentos y logotipos cuando `ALMACENAMIENTO_ARCHIVOS` es `local` |
| `dev_root_node_modules`, `dev_api_node_modules`, `dev_web_node_modules` | Solo en el perfil `full`, para que los enlaces de pnpm sean los de Linux y no los de la maquina anfitriona |
| Red `cotizador-dev-network` | Desarrollo |
| Red `cotizador-network` | `testing` y `production` |

## Imagenes

### Desarrollo: `Dockerfile.dev`

Una unica imagen compartida por la API y la web, sin optimizacion de tamaño.

- Base `node:22-alpine`, Corepack activado, pnpm como unico gestor.
- Contexto de construccion: la raiz del monorepo, porque el workspace lo necesita.
- El codigo se monta como volumen para el recargado en caliente.
- `node_modules` y los directorios de compilacion usan volumenes propios, no el montaje de la maquina
  anfitriona.
- Se activa el sondeo del sistema de archivos con `CHOKIDAR_USEPOLLING` y `WATCHPACK_POLLING`, porque en
  un volumen montado los eventos nativos no llegan de forma fiable.
- Si cambia `pnpm-lock.yaml`, hay que reconstruir sin cache y eliminar el volumen de `node_modules` de
  la raiz.

### Produccion: `apps/api/Dockerfile` y `apps/web/Dockerfile`

Multi etapa, tres etapas:

| Etapa | Que hace |
|-------|----------|
| `deps` | Copia `package.json` de la raiz y de cada paquete, mas `pnpm-lock.yaml` y `pnpm-workspace.yaml`; ejecuta `pnpm install --frozen-lockfile` |
| `build` | Copia el codigo, compila `@cotizador/shared`, luego `@cotizador/database` y luego la aplicacion |
| `runner` | `node:22-alpine` con los artefactos compilados, dependencias de produccion y un usuario sin privilegios |

Reglas:

- Ninguna variable sensible se incorpora a la imagen; llegan por entorno al arrancar.
- Las imagenes no se versionan en el repositorio; los `Dockerfile` si.
- `.dockerignore` excluye `node_modules`, `dist`, `.next`, `docs` y los archivos `.env`.

### Chromium para la generacion de PDF

`decisions/0006-plantillas-de-documento.md` establece que el PDF se produce con un navegador sin
interfaz grafica detras de la interfaz `GeneradorPdf`. Por lo tanto **la imagen de la API instala
chromium** desde los paquetes de Alpine, junto con las fuentes y bibliotecas que necesita para
renderizar texto correctamente.

Puntos que hay que respetar:

1. Se usa el chromium del sistema. La biblioteca de automatizacion no debe descargar su propio binario:
   se desactiva esa descarga y se indica la ruta del ejecutable mediante una variable declarada en el
   propio `Dockerfile`, no en `.env.development`, porque es una propiedad de la imagen y no de la
   configuracion del entorno.
2. El navegador se lanza sin espacio aislado de procesos, ya que el contenedor es el limite de
   aislamiento, y con memoria compartida ampliada para evitar fallos al renderizar documentos largos.
3. El proceso del navegador se cierra siempre, tambien cuando la generacion falla o supera
   `PDF_TIMEOUT_MS`. Un proceso huerfano por documento agota la memoria del contenedor en poco tiempo.
4. La imagen de la web **no** instala chromium.
5. Esta es la razon principal del tamaño de la imagen de la API. Si el consumo de memoria resulta
   molesto, la evolucion prevista es extraer la generacion a un servicio propio, tal como deja anotado
   `decisions/0012-infraestructura-y-entornos.md`.

## Entrypoints y orden de arranque

### API en contenedor: `scripts/docker-entrypoint-api.sh`

```bash
#!/bin/sh
set -e

echo "Esperando PostgreSQL..."
until pg_isready -h postgres -U "${POSTGRES_USER}" > /dev/null 2>&1; do
  sleep 1
done

echo "Ejecutando migraciones..."
node /app/packages/database/dist/run-migrations.js

if [ "${RUN_SEED:-false}" = "true" ]; then
  echo "Ejecutando semilla..."
  node /app/packages/database/dist/seeds/run-seed.js
fi

echo "Iniciando API..."
cd /app/apps/api
exec node dist/main.js
```

Orden de arranque y reglas:

| Paso | Que ocurre | Si falla |
|------|-----------|----------|
| 1 | Espera a que PostgreSQL acepte conexiones, ademas del `depends_on` con `service_healthy` | El contenedor sigue esperando; el reinicio automatico lo vuelve a intentar |
| 2 | Ejecuta las migraciones pendientes | `set -e` aborta y el contenedor no arranca. Es deliberado: una aplicacion contra un esquema incompleto produce errores confusos |
| 3 | Ejecuta la semilla solo si `RUN_SEED` es `true` | Aborta. La semilla es idempotente, por lo que un fallo indica un problema real |
| 4 | Arranca la API con `exec`, para que el proceso de Node sea el proceso principal y reciba las señales de parada | — |

Notas:

- Las migraciones son idempotentes por construccion: TypeORM aplica solo las pendientes segun su tabla
  de control.
- Con varias replicas de la API habria que extraer el paso 2 a un trabajo de despliegue previo. Mientras
  haya una sola replica, el entrypoint basta.
- `synchronize` esta en `false` en todos los entornos. Arrancar la aplicacion **no** crea tablas.

### Desarrollo en contenedor: `scripts/docker-entrypoint-dev.sh`

Solo se usa con el perfil `full`. Instala las dependencias para generar los enlaces de pnpm propios de
Linux, compila `@cotizador/shared` y `@cotizador/database`, y arranca el proceso en modo observador. No
ejecuta migraciones: en desarrollo se lanzan a mano.

### Desarrollo local

Con `pnpm dev` no hay entrypoint. El script `predev` levanta el contenedor de PostgreSQL y despues se
arrancan la API y la web en paralelo. Las migraciones se ejecutan de forma explicita con `pnpm db:migrate`
cuando hacen falta.

## Puesta en marcha local

Secuencia completa, desde un repositorio recien clonado hasta la aplicacion funcionando. Los apartados
que siguen son pasos y deben ejecutarse en el orden en que aparecen.

### Clonar el repositorio y activar pnpm

```bash
git clone <url-del-repositorio> cotizador
cd cotizador
corepack enable
corepack prepare pnpm@9.15.9 --activate
pnpm --version
```

La ultima orden debe imprimir `9.15.9`.

### Crear el archivo de variables

```bash
cp .env.development.example .env.development
```

En PowerShell:

```powershell
Copy-Item .env.development.example .env.development
```

Editar `.env.development` y ajustar como minimo:

- `POSTGRES_USER`, `POSTGRES_PASSWORD` y `POSTGRES_DB`, y reflejar los mismos valores en
  `DATABASE_URL` apuntando a `localhost`.
- `JWT_SECRET`, con un valor generado:

```bash
openssl rand -hex 32
```

- `SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD`, que seran las credenciales del primer acceso.
- `IA_PROVEEDOR=none` para empezar. El producto funciona completo en modo manual sin ninguna credencial
  de IA.

### Instalar dependencias

```bash
pnpm install
```

Se ejecuta una sola vez desde la raiz e instala los cuatro paquetes del workspace.

### Levantar PostgreSQL

```bash
pnpm docker:db
```

Verificar que el contenedor esta sano antes de continuar:

```bash
docker compose --env-file .env.development -f docker-compose.dev.yml ps
```

La columna de estado del servicio `postgres` debe indicar `healthy`.

### Compilar los paquetes internos

```bash
pnpm build:packages
```

Compila `@cotizador/shared` y despues `@cotizador/database`, en ese orden porque el segundo depende del
primero.

### Crear el esquema y los datos iniciales

```bash
pnpm db:migrate
pnpm db:seed
```

La primera orden crea las extensiones `pg_trgm` y `unaccent` y todas las tablas. La segunda carga los
catalogos globales de plataforma y el usuario administrador definido en las variables de semilla. Es
idempotente: se puede repetir sin duplicar datos.

### Arrancar la aplicacion

```bash
pnpm dev
```

Levanta la API y la web en paralelo. Alternativamente, en dos terminales:

```bash
pnpm dev:api
pnpm dev:web
```

### Verificar la instalacion

| Que | Como | Resultado esperado |
|-----|------|--------------------|
| API | `curl http://localhost:3001/api/salud` | Respuesta correcta con el estado de la base de datos |
| Web | Abrir `http://localhost:3000` | Carga la pantalla de acceso |
| Acceso | Iniciar sesion con `SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD` | Entra al area de plataforma |
| Base de datos | `docker compose --env-file .env.development -f docker-compose.dev.yml exec postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -c '\dt'` | Lista las tablas creadas por las migraciones |

## Operacion corriente

| Necesidad | Orden |
|-----------|-------|
| Trabajo diario | `pnpm dev` |
| Solo la base de datos | `pnpm docker:db` |
| Stack completo en contenedores | `pnpm docker:dev` |
| Detener los contenedores | `pnpm docker:down` |
| Ver la salida de los contenedores | `pnpm docker:logs` |
| Aplicar migraciones pendientes | `pnpm db:migrate` |
| Generar una migracion tras cambiar entidades | `pnpm db:migration:generate` |
| Revertir la ultima migracion | `pnpm db:migration:revert` |
| Empezar de cero, destruyendo los datos | `docker compose --env-file .env.development -f docker-compose.dev.yml down -v` y repetir desde el apartado de levantar PostgreSQL |

## Problemas frecuentes

| Sintoma | Causa habitual | Solucion |
|---------|----------------|----------|
| `pnpm dev` falla con error de conexion a la base de datos | Docker no esta corriendo o el contenedor aun no esta sano | Arrancar Docker y esperar a que `postgres` figure como `healthy` |
| La API arranca pero toda consulta falla con tabla inexistente | No se ejecutaron las migraciones | `pnpm db:migrate` |
| Un import de `@cotizador/shared` no se encuentra | Los paquetes internos no estan compilados | `pnpm build:packages` |
| La web no alcanza la API | `NEXT_PUBLIC_API_URL` apunta a un nombre de servicio de Docker | Debe ser la direccion publica, `http://localhost:3001/api` |
| El navegador bloquea las peticiones por origen cruzado | `CORS_ORIGIN` no incluye la direccion de la web | Ajustar `CORS_ORIGIN` y reiniciar la API |
| La sesion se pierde al recargar | `COOKIE_SAMESITE` incompatible con la combinacion de dominios | Usar `lax` en desarrollo con el mismo dominio |
| El PDF no se genera en el contenedor | Falta chromium o el ejecutable esta en otra ruta | Reconstruir la imagen de la API y verificar la variable de ruta del ejecutable |
| Tras cambiar dependencias, el contenedor usa las antiguas | El volumen de `node_modules` conserva la instalacion previa | Reconstruir sin cache y eliminar el volumen `dev_root_node_modules` |

## Criterios de aceptacion

- [ ] `pnpm install`, `pnpm docker:db`, `pnpm build:packages`, `pnpm db:migrate`, `pnpm db:seed` y
      `pnpm dev` funcionan en una maquina limpia siguiendo solo este documento.
- [ ] El endpoint de salud responde correctamente y el healthcheck de `api` pasa.
- [ ] Los datos de PostgreSQL persisten al detener y volver a levantar los contenedores.
- [ ] El perfil `full` levanta los tres servicios y la web alcanza la API.
- [ ] El entrypoint de la API aborta el arranque si una migracion falla.
- [ ] La semilla se puede ejecutar dos veces seguidas sin duplicar datos.
- [ ] Se genera un PDF desde el contenedor de la API sin dejar procesos de navegador abiertos.
- [ ] `.env.development.example` contiene exactamente las variables que el codigo lee.

## Documentos relacionados

- `decisions/0012-infraestructura-y-entornos.md` — por que esta infraestructura.
- `decisions/0006-plantillas-de-documento.md` — por que hace falta chromium.
- `decisions/0004-proveedor-de-ia-abstraido.md` — que hacen las variables de IA.
- `docs/11-arquitectura-monorepo.md` — que hay dentro del repositorio.
- `docs/10-convenciones-git-y-calidad.md` — como se integra un cambio.
