# ADR 0009: Stack tecnologico

## Estado

Aceptada — 2026-09-17

## Contexto

El producto es una aplicacion web multi-organizacion con cuatro exigencias tecnicas que condicionan la
eleccion de herramientas:

1. **Aislamiento estricto por organizacion** en cada consulta, con un modelo de datos que debe poder
   evolucionar de forma controlada y auditable en produccion con datos reales de varios negocios.
2. **Busqueda tolerante a errores de escritura** sobre el catalogo, con similitud de trigramas y
   normalizacion de acentos, mas atributos variables por rubro consultables.
3. **Aritmetica exacta de importes**, porque un error de centavos en una cotizacion es un problema
   comercial, no un defecto cosmetico.
4. **Una misma logica de validacion y de calculo ejecutandose en el servidor y en el navegador**, para
   que el operador vea el recalculo inmediato mientras edita un borrador sin que exista una segunda
   implementacion que pueda divergir.

A eso se suma una restriccion de equipo: el proyecto lo construye un grupo pequeño. El stack debe
favorecer la convencion sobre la configuracion, tener un unico lenguaje de punta a punta y no exigir
mantener infraestructura accesoria.

Este ADR fija las tecnologias y sus versiones. Los ADR anteriores fijaron las reglas de negocio y de
arquitectura que el stack debe poder sostener; ninguna eleccion de aqui las modifica.

## Decision

Se adopta un monorepo TypeScript con NestJS y TypeORM en el backend, Next.js con React en el frontend,
PostgreSQL como unica base de datos y Zod como lenguaje comun de validacion entre ambos lados.

### Tabla de tecnologias

| Capa | Tecnologia | Version | Motivo |
|------|-----------|---------|--------|
| Gestor de paquetes | pnpm | 9.15.9 | Workspaces nativos, instalacion rapida y enlaces deterministas entre paquetes internos |
| Resolucion de modulos | node-linker=hoisted | — | Compatibilidad con decoradores y carga de entidades de TypeORM dentro de contenedores |
| Entorno de ejecucion | Node.js | 22 (`node:22-alpine` en Docker) | Version con soporte a largo plazo, misma version en desarrollo y en produccion |
| Lenguaje | TypeScript | ^5.9.2 | `strict: true`, objetivo ES2022 en backend y ES2017 en web, decoradores habilitados en backend |
| Framework backend | NestJS | ^11.1.6 | Modulos, inyeccion de dependencias, guards e interceptores; estructura impuesta que hace evidente donde se autoriza y donde se filtra por organizacion |
| Acceso a datos | TypeORM | ^0.3.26 | Entidades con decoradores, `QueryBuilder` para las consultas de similitud y migraciones explicitas; `synchronize: false` siempre |
| Driver de base de datos | pg | ^8.16.3 | Driver oficial, requerido por TypeORM |
| Base de datos | PostgreSQL | 16-alpine | `pg_trgm`, `unaccent`, JSONB con indice GIN y `numeric` exacto |
| Credenciales | bcryptjs | ^3.0.2 | Hash de contraseñas sin dependencias nativas que compilar en la imagen |
| Sesion | @nestjs/jwt | ^11.0.2 | Token de acceso corto firmado |
| Cookies | cookie-parser | ^1.4.7 | Token de refresco en cookie `httpOnly`, no accesible desde el navegador |
| Framework frontend | Next.js | ^15.5.4 | App Router, Turbopack en desarrollo, route groups para separar el area autenticada del acceso |
| Biblioteca de interfaz | React | ^19.1.1 | Version requerida por Next.js 15 |
| Estilos | Tailwind CSS | ^4.1.13 | Integrado con `@tailwindcss/postcss`; los tokens de diseño se declaran con `@theme inline` en `globals.css`, sin archivo de configuracion JavaScript |
| Estado de servidor | @tanstack/react-query | ^5.90.2 | Cache, invalidacion y estados de carga sin escribir un gestor de estado propio |
| Iconos | lucide-react | — | Conjunto unico y coherente, importable por icono |
| Composicion de clases | clsx + tailwind-merge | — | Resolucion de conflictos de clases utilitarias en componentes con variantes |
| Cliente HTTP | `fetch` nativo | — | Disponible en Node 22 y en el navegador; no se agrega una dependencia para lo que el entorno ya provee |
| Validacion | Zod | ^3.25.76 | Esquema unico compartido entre backend y frontend, en `@cotizador/shared` |
| Generacion de PDF | Navegador sin interfaz grafica | — | Detras de la interfaz `GeneradorPdf`; requiere chromium en la imagen de la API |
| Formato | Prettier | ^3.6.2 | Configurado una sola vez en la raiz del monorepo |
| Analisis estatico | ESLint 9 (flat config) + eslint-config-next | 9 | Solo en `apps/web`, para las reglas propias de React y Next.js |
| Variables de entorno | dotenv-cli | — | Carga `.env.development` desde los scripts de la raiz, sin duplicar archivos por aplicacion |
| Pruebas | Vitest | — | Reglas puras, motor de precios y normalizacion de texto |

### Configuracion de TypeScript

| Ambito | Objetivo | Modulo | Decoradores | Notas |
|--------|----------|--------|-------------|-------|
| `apps/api` | ES2022 | CommonJS | Si | `experimentalDecorators` y `emitDecoratorMetadata` para NestJS y TypeORM |
| `apps/web` | ES2017 | ESNext | No | Configuracion generada por Next.js, con `paths` para `@/*` |
| `packages/*` | ES2022 | CommonJS | Si en `database` | Compilan a `dist/` y se consumen por los `exports` del paquete |

`strict: true` es obligatorio en los cuatro paquetes. `any` requiere justificacion escrita en el mismo
archivo.

### Por que Zod compartido entre backend y frontend

Zod no se elige como validador del backend: se elige como **formato unico de contrato**. Los esquemas
viven en `@cotizador/shared` y se consumen desde los dos lados con el mismo codigo.

1. **Una sola definicion de cada contrato.** El esquema de creacion de un item, el de una linea de
   cotizacion y el de la plantilla de documento se escriben una vez. El formulario del navegador valida
   contra el mismo objeto con el que el servidor rechaza la peticion. No existe la clase de defecto en
   la que la interfaz permite guardar algo que la API rechaza, ni la inversa.
2. **Los tipos se derivan del esquema, no se declaran aparte.** Con `z.infer` el tipo de TypeScript y
   la validacion en tiempo de ejecucion no pueden separarse. Un campo agregado al esquema rompe la
   compilacion en todos los puntos que deben actualizarse.
3. **Es el unico mecanismo viable para la validacion dinamica de atributos.** Segun
   `decisions/0002-catalogo-generico-por-vertical.md`, el documento JSON de atributos de un item se
   valida contra las definiciones de atributo de la organizacion, que son datos y cambian en tiempo de
   ejecucion. Eso exige **construir el esquema en tiempo de ejecucion**. Zod lo permite de forma
   natural; un validador basado en decoradores sobre clases no, porque las clases se fijan al compilar.
4. **Es el unico mecanismo viable para blindar la salida del modelo de lenguaje.** Segun
   `decisions/0003-pipeline-precotizacion.md`, la respuesta de la IA se valida con un esquema estricto
   que rechaza campos no declarados; una respuesta con precios es un fallo de la etapa. Zod valida un
   objeto JSON arbitrario recibido de un tercero, que no es una instancia de ninguna clase del sistema.
5. **La plantilla de documento es una configuracion declarativa validada con Zod**, ya definida en
   `decisions/0006-plantillas-de-documento.md`. Ese esquema se usa en el servidor para persistir y en
   el navegador para el formulario de configuracion y la vista previa.

La consecuencia practica es que el backend **no usa DTO de NestJS ni class-validator**. Los controladores
reciben el cuerpo de la peticion sin tipar y lo pasan por un pipe de validacion generico que aplica el
esquema Zod correspondiente y devuelve el tipo inferido.

### Por que TypeORM con migraciones explicitas

1. **`synchronize: false` sin excepciones, en todos los entornos.** La sincronizacion automatica de
   esquema es aceptable en un proyecto de un solo usuario; en una plataforma con datos de varios
   negocios es una via directa a la perdida de datos. Todo cambio de esquema es un archivo de migracion
   revisado, versionado y reversible.
2. **Las migraciones son el lugar donde viven cosas que el ORM no modela.** El producto necesita
   `CREATE EXTENSION pg_trgm`, `CREATE EXTENSION unaccent`, indices GIN con `gin_trgm_ops` sobre la
   columna de texto de busqueda y sobre los alias, e indices compuestos que empiezan por
   `organizacionId`. Nada de eso se deriva de una entidad: se escribe como SQL en una migracion.
3. **Consultas complejas con control total del SQL.** La cascada de resolucion de
   `decisions/0007-estrategia-de-matching.md` compara similitud de trigramas, ordena por puntaje y
   limita resultados. `QueryBuilder` permite escribir eso sin pelear con una abstraccion que no lo
   contempla, y permite caer a SQL directo cuando hace falta.
4. **Decoradores sobre las mismas clases que usa NestJS.** Entidad, repositorio e inyeccion de
   dependencias comparten modelo mental. La curva de entrada de una persona nueva al modulo es corta.
5. **Tipos `numeric` preservados.** Los importes se declaran `numeric(18,4)` y las tasas
   `numeric(18,6)`, con transformadores explicitos que los transportan como cadena, tal como exige
   `decisions/0005-motor-de-precios.md`.

El costo asumido es conocido: el sistema de tipos de TypeORM es mas debil que el de alternativas mas
modernas y sus relaciones exigen disciplina para no provocar consultas en cascada. Se acepta a cambio
del control sobre el SQL y sobre la evolucion del esquema.

## Alternativas descartadas

### Prisma en lugar de TypeORM

**Pros:** el mejor sistema de tipos del ecosistema, cliente generado a partir de un unico archivo de
esquema, migraciones con buena experiencia de desarrollo, consultas legibles y seguras.
**Contras:** el esquema vive en un lenguaje propio fuera de TypeScript, lo que separa el modelo de datos
del resto del codigo; el soporte de tipos `numeric` obliga a trabajar con un tipo decimal del cliente o
a convertir a cadena manualmente; las consultas de similitud de trigramas con `pg_trgm` y los indices
GIN caen fuera del modelo y exigen `$queryRaw`, perdiendo precisamente la ventaja de tipos que motiva
la eleccion; y la integracion con la inyeccion de dependencias de NestJS es un envoltorio manual.
**Descartada** porque el camino critico del producto, que es la busqueda por similitud sobre el
catalogo, es justamente el caso que Prisma resuelve peor. Si el matching fuera una busqueda por igualdad,
la decision seria la contraria.

### Express o Fastify solo, sin framework de aplicacion

**Pros:** menos abstraccion, menos dependencias, arranque mas rapido, control total del ciclo de la
peticion.
**Contras:** cada proyecto inventa su propia organizacion de carpetas, su forma de inyectar
dependencias, su manejo de transacciones y su composicion de middleware. En este producto eso es un
riesgo concreto y no una cuestion de gusto: el aislamiento por organizacion de
`decisions/0001-multi-tenancy-por-organizacion.md` depende de que exista **un unico lugar evidente**
donde se construye el `OrgContext` y **un unico lugar evidente** donde se verifican permisos. Los guards
de NestJS son ese lugar y no se pueden saltar por descuido.
**Descartada.** El aislamiento entre organizaciones descansa en la disciplina del codigo, y un framework
opinado convierte parte de esa disciplina en estructura.

### Remix o Vite con una aplicacion de pagina unica en lugar de Next.js

**Pros:** Vite con una aplicacion de pagina unica es la configuracion mas simple y de arranque mas
rapido para una herramienta interna detras de un acceso; Remix tiene un modelo de datos por ruta muy
claro.
**Contras:** con una aplicacion de pagina unica se pierde el renderizado en el servidor para las
pantallas publicas futuras y hay que resolver a mano el enrutado, la division de codigo y la carga de
datos por ruta. En el caso de Remix, la ventaja principal es su acoplamiento entre ruta y datos, que
aqui no se aprovecha porque los datos vienen de una API REST separada y se gestionan con React Query.
Ademas Next.js aporta los route groups, que se usan para separar `(auth)` de `(app)` con layouts
distintos, y una convencion de carpetas que no hay que discutir.
**Descartada.** Next.js es ademas el entorno con mayor cantidad de material de referencia, lo que reduce
el costo de incorporar a alguien al proyecto.

### class-validator y DTO de NestJS en lugar de Zod

**Pros:** es la via idiomatica de NestJS, esta documentada en todas partes, se integra con el
`ValidationPipe` incorporado y genera la documentacion OpenAPI casi sin trabajo adicional.
**Contras:** las reglas viven como decoradores sobre clases del backend, por lo que **el frontend no
puede reutilizarlas**: habria que reescribir cada validacion en el formulario y mantener las dos copias
sincronizadas a mano. Ademas no permite construir un validador en tiempo de ejecucion a partir de datos,
que es exactamente lo que exigen los atributos por vertical; y validar la respuesta de un modelo de
lenguaje, que es un JSON arbitrario y no una instancia de clase, obliga a un paso de transformacion
previo con `plainToInstance` que ademas no rechaza campos desconocidos de forma estricta sin
configuracion adicional.
**Descartada.** El producto pierde su propiedad mas valiosa, que es el contrato unico entre las dos
aplicaciones. La documentacion OpenAPI se obtiene igual, generandola desde los esquemas Zod.

### shadcn/ui con Radix en lugar de componentes propios

**Pros:** componentes accesibles y probados, velocidad inicial muy alta, comportamiento correcto en
menus, dialogos y selectores sin escribirlo.
**Contras:** copia decenas de archivos al repositorio junto con una cadena de dependencias de Radix que
hay que mantener; su estetica por defecto exige trabajo de personalizacion para no quedar generica; y el
producto no necesita el catalogo completo de componentes, sino un conjunto reducido y muy especifico
gobernado por la guia de interfaz: la tabla de lineas con semaforo, el selector de candidatos, el
editor de plantilla y las pantallas de catalogo. Ademas Tailwind CSS 4 con tokens declarados en
`@theme inline` cambia la forma de personalizar respecto de lo que esos componentes asumen.
**Descartada.** Se construye un conjunto reducido de componentes propios en `apps/web/src/components/ui`,
con `clsx` y `tailwind-merge` para las variantes. La accesibilidad de los pocos componentes con
comportamiento complejo se resuelve de forma explicita y se verifica en la revision.

### MongoDB en lugar de PostgreSQL

**Pros:** los atributos variables por vertical encajan de forma natural en un documento sin esquema, no
haria falta validacion dinamica contra definiciones de atributo y el modelo de items seria mas directo.
**Contras:** es incompatible con tres requisitos ya decididos y no negociables del producto.

| Requisito | Origen | Por que MongoDB no lo cubre |
|-----------|--------|------------------------------|
| Similitud de trigramas con `pg_trgm` y normalizacion con `unaccent` | `decisions/0007-estrategia-de-matching.md` | El indice de texto de MongoDB opera sobre palabras completas y radicacion; no tolera errores de escritura como "tuvo" por "tubo", que son la norma en mensajes de WhatsApp. Cubrirlo exigiria un motor de busqueda externo, es decir mas infraestructura para lo que PostgreSQL ya hace |
| Aritmetica decimal exacta en `numeric(18,4)` | `decisions/0005-motor-de-precios.md` | `Decimal128` existe, pero el ecosistema de controladores y la mayor parte de las operaciones de agregacion empujan hacia el punto flotante. Los importes son el dato donde no se admite ambiguedad |
| Transaccion unica que persiste solicitud, interpretacion, cotizacion, lineas, candidatos y evento | `decisions/0003-pipeline-precotizacion.md`, etapa 5 | Requiere transacciones multi documento con un conjunto de replicas configurado, es decir pagar en complejidad operativa por algo que una base relacional da de entrada |

Ademas el modelo real del producto es marcadamente relacional: organizacion, sucursal, usuario, item,
alias, lista de precios, precio, regla, cliente, cotizacion, linea, candidato y evento. La unica parte
con forma de documento son los atributos y las compatibilidades, y eso se resuelve con columnas JSONB
indexadas con GIN, que es exactamente lo que decidio
`decisions/0002-catalogo-generico-por-vertical.md`.

**Descartada.** PostgreSQL no es una preferencia de este ADR: es un **requisito derivado** de decisiones
de negocio anteriores. `pg_trgm`, JSONB y `numeric` exacto son tres razones independientes, y cada una
por si sola basta.

### Un solo proceso Next.js con rutas de API en lugar de un backend separado

**Pros:** un unico despliegue, sin CORS, sin duplicar la configuracion de autenticacion.
**Contras:** la logica de dominio queda atada al ciclo de vida del framework de interfaz; las
transacciones, los guards de permisos y los trabajos de generacion de PDF conviven con el renderizado; y
se pierde la posibilidad de que un cliente distinto, como una aplicacion movil o una integracion futura
con WhatsApp, consuma la misma API sin cambios de contrato.
**Descartada.** La separacion en dos aplicaciones se detalla en
`decisions/0010-monorepo-y-paquetes.md`.

## Consecuencias

- Un unico lenguaje, TypeScript, de la base de datos a la interfaz. Una persona puede seguir un campo
  desde la migracion hasta el formulario sin cambiar de contexto mental.
- El backend no tiene DTO ni decoradores de validacion. Quien venga de NestJS idiomatico encontrara un
  pipe de validacion generico con Zod en su lugar, y eso debe estar documentado en las convenciones de
  implementacion.
- Toda modificacion del modelo de datos exige generar y revisar una migracion. Es mas lento que
  sincronizar el esquema automaticamente y es deliberado.
- El motor de precios y la normalizacion de texto se ejecutan igual en el servidor y en el navegador,
  porque son funciones puras en `@cotizador/shared` sin dependencias de framework.
- La imagen de la API incluye chromium, lo que aumenta su tamaño y su consumo de memoria. El impacto y
  las alternativas se tratan en `decisions/0012-infraestructura-y-entornos.md`.
- No hay biblioteca de componentes de terceros, por lo que el conjunto base de `apps/web` es trabajo
  propio y la accesibilidad es responsabilidad explicita de la revision de codigo.
- Las versiones de esta tabla se fijan con el lockfile de pnpm, que se versiona siempre. Actualizar una
  version mayor de cualquiera de estas piezas requiere una nota en este ADR.

## Referencias

- `docs/06-diseno-tecnico.md`
- `docs/11-arquitectura-monorepo.md`
- `docs/12-infraestructura-docker.md`
- `decisions/0002-catalogo-generico-por-vertical.md`
- `decisions/0005-motor-de-precios.md`
- `decisions/0007-estrategia-de-matching.md`
- `decisions/0010-monorepo-y-paquetes.md`
