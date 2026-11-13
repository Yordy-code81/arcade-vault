# SPEC 03 — Supabase: catálogo de juegos

> **Status:** Implementado
> **Depends on:** SPEC 02
> **Date:** 2026-11-13
> **Objective:** Mover el catálogo de 8 juegos de `lib/data.ts` a una tabla `public.games` en Supabase y que todas las pantallas lo lean desde ahí con `"use cache"`, sin cambios visibles en la app.

---

## Por qué existe esta spec

SPEC 02 dividió la integración con Supabase en tres partes; esta es la segunda.
El catálogo vive hoy como constante `GAMES` en `lib/data.ts`, así que añadir o cambiar un juego exige un deploy.
SPEC 04 (puntuaciones) necesita una tabla `games` a la que apuntar con una foreign key.

---

## Alcance

**Dentro:**

- Migración `public.games` con RLS (lectura pública, sin escrituras) y seed de los 8 juegos actuales con los mismos datos, incluidos `best` y `plays`.
- Tipos regenerados en `lib/supabase/database.types.ts`.
- Cliente Supabase sin cookies para lecturas públicas cacheables (`lib/supabase/public.ts`).
- `lib/games.ts` (server-only): `getGames()` y `getGame(id)` con `"use cache"`, `cacheLife("days")` y `cacheTag("games")`, que devuelven el mismo tipo `Game` de hoy.
- Páginas servidor que leen el catálogo y lo pasan por props:
  - `/` → `<Library games={…} />`
  - `/salon-de-la-fama` → `<HallOfFame games={…} />`
  - `/juegos/[id]` y `/juegos/[id]/jugar` → `getGame(id)` y `generateStaticParams` desde `getGames()`.
- `lib/data.ts` se queda con tipos, `CATEGORIES` y `seededScores`; desaparecen `GAMES` y `getGame`.

**Fuera de alcance (para specs futuras):**

- Tabla de puntuaciones, leaderboard y Salón reales; `best` y `plays` calculados (SPEC 04).
- Integrar juegos jugables reales (Asteroids, Tetris, Arkanoid de `references/started-games/`).
- Panel de administración o cualquier escritura en `games` desde la app.
- Endpoint o Server Action de revalidación (`revalidateTag("games")`).
- Categorías en tabla propia o portadas como imágenes subidas a Storage.
- Tests automatizados.

---

## Modelo de datos

### Base de datos

Migración `supabase/migrations/<timestamp>_games.sql` (timestamp UTC en el momento de crearla, formato `YYYYMMDDHHMMSS`):

```sql
create table public.games (
  id          text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title       text not null,
  short_desc  text not null,
  long_desc   text not null,
  category    text not null check (category in ('ARCADE', 'PUZZLE', 'SHOOTER', 'VERSUS')),
  cover       text not null,                -- clase CSS de la portada (cover-bricks…)
  color       text not null check (color in ('cyan', 'magenta', 'yellow', 'green')),
  best        integer not null default 0 check (best >= 0),  -- mock hasta SPEC 04
  plays       text not null default '0',                     -- mock hasta SPEC 04 ("12.4K")
  sort_order  smallint not null unique,
  created_at  timestamptz not null default now()
);

alter table public.games enable row level security;

create policy "games are readable by everyone"
  on public.games for select to anon, authenticated using (true);

-- Sin políticas de insert/update/delete: el catálogo se cambia solo con migraciones.

insert into public.games (id, title, short_desc, long_desc, category, cover, color, best, plays, sort_order) values
  ('bloque-buster', 'BLOQUE BUSTER', …, 1),
  …
  ('duelo-pixel', 'DUELO PIXEL', …, 8);
```

Los 8 `insert` copian literalmente los valores actuales de `GAMES` en `lib/data.ts`, en el mismo orden (`sort_order` 1–8).

### Código

`lib/supabase/public.ts` (server-only):

```ts
// Cliente sin sesión ni cookies: solo para datos públicos dentro de "use cache".
export function createPublicClient(): SupabaseClient<Database>; // auth.persistSession = false
```

`lib/games.ts` (server-only):

```ts
export async function getGames(): Promise<Game[]>; // order by sort_order
export async function getGame(id: string): Promise<Game | undefined>;
```

- Ambas con `"use cache"`, `cacheLife("days")` y `cacheTag("games")`.
- Mapeo fila → `Game`: `short_desc → short`, `long_desc → long`, `category → cat`; el resto igual. `Category` y `NeonColor` se estrechan desde `text` con un cast tras el `check` de la base.
- Si Supabase devuelve error, lanzan `Error` (falla el build o salta el error boundary); no hay fallback al mock.

`lib/data.ts`: se mantienen `Category`, `CategoryFilter`, `NeonColor`, `Game`, `ScoreRow`, `CATEGORIES` y `seededScores`. Se eliminan `GAMES` y `getGame`.

---

## Estructura de archivos

```text
supabase/
  migrations/
    <timestamp>_games.sql            (nuevo: tabla, RLS, seed)
lib/
  supabase/
    public.ts                        (nuevo)
    database.types.ts                (regenerado)
  games.ts                           (nuevo)
  data.ts                            (modificado: sin GAMES ni getGame)
app/
  page.tsx                           (modificado: lee getGames() y lo pasa a Library)
  salon-de-la-fama/page.tsx          (modificado: lee getGames() y lo pasa a HallOfFame)
  juegos/[id]/page.tsx               (modificado: getGame/getGames desde lib/games)
  juegos/[id]/jugar/page.tsx         (modificado: getGame/getGames desde lib/games)
components/
  library.tsx                        (modificado: prop games)
  hall-of-fame.tsx                   (modificado: prop games)
```

---

## Plan de implementación

1. Escribir `supabase/migrations/<timestamp>_games.sql` (tabla, RLS, política, seed de los 8 juegos). Aplicarla con `apply_migration` del MCP usando el mismo nombre. Pasar `get_advisors` (security) y corregir avisos sobre `games`. Verificar con `execute_sql` que hay 8 filas en el orden correcto.
2. Regenerar `lib/supabase/database.types.ts` con `generate_typescript_types`. Verificar con `npm run build`.
3. Crear `lib/supabase/public.ts` y `lib/games.ts`, consultando antes `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-cache.md` y `04-functions/cacheTag.md`. Verificar con `npm run build` (aún sin usarlos).
4. Pasar las páginas al catálogo de Supabase: `app/page.tsx` + `components/library.tsx`, `app/salon-de-la-fama/page.tsx` + `components/hall-of-fame.tsx`, y las dos páginas de `/juegos/[id]`. Quitar `GAMES` y `getGame` de `lib/data.ts`. Verificar con `npm run build` que las 8 rutas de detalle y las 8 de jugar siguen prerenderizándose.
5. Prueba manual con `npm run dev` (Playwright): las cinco pantallas se ven igual que antes; un id inexistente (`/juegos/nope`) muestra el 404. Pasar `npm run lint` y `npm run build`.

---

## Criterios de aceptación

- [x] `npm run build` termina sin errores de tipos ni de prerender, y genera `/juegos/[id]` y `/juegos/[id]/jugar` para los 8 ids.
- [x] `npm run lint` termina sin errores.
- [x] `list_migrations` del MCP muestra la migración `games` aplicada en el proyecto remoto.
- [x] `select id, sort_order from public.games order by sort_order` devuelve los 8 ids en el orden actual: `bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`, `rocas`, `ranaria`, `duelo-pixel`.
- [x] `public.games` tiene RLS activado y `get_advisors` (security) no reporta avisos sobre `games`.
- [x] Un `insert` en `public.games` con la publishable key (rol `anon`) es rechazado.
- [x] Ningún archivo importa `GAMES` ni `getGame` desde `@/lib/data`.
- [x] La Biblioteca muestra los 8 juegos; la búsqueda y los chips de categoría filtran igual que antes.
- [x] El Detalle de cada juego muestra título, descripción larga, categoría, récord y partidas idénticos a los de SPEC 02.
- [x] El Salón muestra una pestaña por juego en el mismo orden y el Reproductor carga para cualquier id.
- [x] `/juegos/nope` y `/juegos/nope/jugar` muestran la página 404.
- [x] No hay errores en la consola del navegador en ninguna de las cinco pantallas.
  - **Nota:** en `next dev`, `/juegos/[id]` y `/juegos/[id]/jugar` registran el aviso de _instant navigation_ "`params` accessed outside of `<Suspense>`" (y "Could not validate `instant`" en los 404). Es un aviso solo de desarrollo de `partialPrefetching`, no bloquea el build y viene de leer `params` sin `<Suspense>`, patrón que estas páginas ya tenían antes de esta spec. Aceptado; mover esas rutas a `<Suspense>` queda para una spec futura.

---

## Decisiones

- **Sí:** cargar los 8 juegos actuales de `lib/data.ts`, tal cual. La app no cambia visualmente; los juegos jugables reales llegan en otra spec.
- **Sí:** guardar `best` y `plays` como columnas mock. Evita cambiar la UI ahora; SPEC 04 las sustituirá por valores calculados desde las puntuaciones.
- **Sí:** `plays` como `text` ("12.4K"). Es un dato de presentación mock que va a desaparecer; no compensa modelarlo como número.
- **Sí:** `id` de texto (el slug actual) como clave primaria. Las URLs `/juegos/<id>` no cambian y SPEC 04 puede referenciarlo con una FK.
- **Sí:** `category` y `color` como `text` con `check`. Más simple que un `enum` de Postgres para cuatro valores y fácil de ampliar con otra migración.
- **No:** tabla `categories`. `CATEGORIES` sigue en código; no hay nada más que modelar.
- **Sí:** `sort_order` explícito y único. Conserva el orden actual en Biblioteca y Salón sin depender del orden de inserción.
- **Sí:** seed dentro de la misma migración. El catálogo es parte del esquema versionado; no hay entorno local de Supabase donde usar `seed.sql`.
- **Sí:** solo lectura pública por RLS, sin políticas de escritura. Los cambios al catálogo van por migración.
- **Sí:** `"use cache"` + `cacheLife("days")` + `cacheTag("games")`. Las páginas siguen siendo estáticas y `generateStaticParams` funciona; el catálogo cambia muy poco.
- **No:** lectura dinámica con `<Suspense>`. Volvería dinámicas todas las páginas sin beneficio real.
- **Sí:** cliente sin cookies (`lib/supabase/public.ts`). `cookies()` no se puede llamar dentro de `"use cache"` y el catálogo no depende del usuario.
- **Sí:** pasar el catálogo por props desde las páginas servidor a `Library` y `HallOfFame`. Sin peticiones extra desde el navegador.
- **No:** consultar Supabase desde componentes cliente.
- **Sí:** error de Supabase → `throw`. Un catálogo vacío silencioso sería peor que un build fallido.
- **No:** revalidación bajo demanda en esta spec. Sin panel de administración no hay quien la dispare; se añadirá cuando exista.

---

## Riesgos

| Riesgo                                                                                             | Mitigación                                                                                                      |
| -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| El build depende de que Supabase responda (prerender de las páginas).                              | Aceptado. El `throw` hace visible el fallo; reintentar el build.                                                |
| Un cambio manual en la tabla no se ve hasta que expire `cacheLife("days")` o haya un nuevo deploy. | Aceptado: los cambios van por migración y deploy. El `cacheTag("games")` deja preparada la revalidación futura. |
| El cast de `text` a `Category` / `NeonColor` podría ocultar un valor inválido.                     | Los `check` de la tabla impiden valores fuera de la unión.                                                      |
| Diferencias de copia al trasladar textos con tildes al SQL del seed.                               | Criterio de aceptación de comparar el Detalle de cada juego con lo actual.                                      |
| APIs de Next 16 (`"use cache"`, `cacheLife`, `cacheTag`) distintas a las conocidas.                | Consultar `node_modules/next/dist/docs/01-app/` antes del paso 3, como exige `AGENTS.md`.                       |

---

## Lo que **no** está en esta spec

- Puntuaciones reales, leaderboard ni Salón reales (SPEC 04).
- Juegos jugables reales.
- Panel de administración o escritura del catálogo desde la app.
- Revalidación bajo demanda.
- Tests automatizados.

Cada uno de esos puntos, si llega, va en su propia spec.
