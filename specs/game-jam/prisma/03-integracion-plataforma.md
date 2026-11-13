# SPEC — PRISMA: integración en la plataforma

> **Estado:** Borrador
> **Depende de:** SPEC 01, SPEC 03, `specs/game-jam/prisma/01-diseno-juego.md`, `specs/game-jam/prisma/02-implementacion.md`
> **Fecha:** 2026-11-13
> **Objetivo:** Añadir PRISMA al catálogo de `public.games` con su portada y hacer que `/juegos/prisma/jugar` monte el juego real en el Reproductor en lugar de la partida simulada.

---

## Alcance

**Dentro:**

- Migración que inserta la fila `prisma` en `public.games` (`sort_order` 9).
- Portada CSS `.cover-prisma` en `app/globals.css`.
- Registro de juegos jugables `components/games/playable.ts` (id → componente).
- `components/game-player.tsx`: si el juego es jugable, monta `PrismaGame` en la `.crt-screen`; el HUD muestra `TIEMPO` y `ESPECTROS` en lugar de `VIDAS` y `NIVEL`.
- Botones PAUSA, FIN, SALIR, JUGAR DE NUEVO y GUARDAR PUNTUACIÓN conectados al juego real.
- Borrado de `app/laboratorio/` (creado en la spec 02).
- Actualización de `references/implemented-games.md` y de la línea "8 games" de `CLAUDE.md`.

**Fuera de alcance (para specs futuras):**

- Persistencia real de puntuaciones, leaderboard y Salón de la Fama desde Supabase (SPEC 04).
- Cambiar `best` / `plays` de otros juegos.
- Integrar Asteroids, Tetris o Arkanoid de `references/started-games/`.
- Portar la portada a `references/templates/styles.css`.
- Sonido.

---

## Modelo de datos

### Fila de `public.games`

Migración `supabase/migrations/<timestamp>_add_prisma_game.sql` (timestamp UTC `YYYYMMDDHHMMSS`, renombrado a la versión que asigne Supabase):

```sql
insert into public.games (id, title, short_desc, long_desc, category, cover, color, best, plays, sort_order) values
  ('prisma', 'PRISMA',
   'Alinea prismas de neón antes de que se apague el reloj.',
   'Intercambia prismas vecinos para alinear tres o más del mismo color y descomponer la luz en cascadas. Recompón el espectro completo de seis colores para liberar un destello de luz blanca. Tienes 90 segundos exactos.',
   'PUZZLE', 'cover-prisma', 'magenta', 0, '0', 9);
```

- No cambia el esquema: no hace falta regenerar `lib/supabase/database.types.ts`.
- `best = 0` y `plays = '0'`: es un juego nuevo y SPEC 04 calculará los valores reales.

### Registro de jugables — `components/games/playable.ts`

```ts
export const PLAYABLE_GAMES = { prisma: PrismaGame } as const;
export type PlayableId = keyof typeof PLAYABLE_GAMES;
export function isPlayable(id: string): id is PlayableId;
```

### Estado añadido en `GamePlayer`

```ts
const [hud, setHud] = useState<PrismaHud>({
  score: 0,
  timeLeftMs: 90_000,
  spectra: 0,
});
const [runKey, setRunKey] = useState(0); // se incrementa en JUGAR DE NUEVO para remontar
const gameRef = useRef<PrismaGameHandle>(null); // FIN → gameRef.current.finish()
```

- La puntuación final del modal es la que llega en `onGameOver`, no la del HUD.
- Los 8 juegos simulados conservan su `Run` y su `tick` sin cambios.

---

## Estructura de archivos

```text
supabase/
  migrations/
    <timestamp>_add_prisma_game.sql   (nuevo)
app/
  globals.css                         (modificado: .cover-prisma)
  laboratorio/                        (borrado)
components/
  games/
    playable.ts                       (nuevo)
  game-player.tsx                     (modificado)
references/
  implemented-games.md                (modificado: 9 juegos, ficha de PRISMA)
CLAUDE.md                             (modificado: "8 games" → "9 games")
```

---

## Plan de implementación

1. Escribir `supabase/migrations/<timestamp>_add_prisma_game.sql` y aplicarla con `apply_migration` del MCP. Renombrar el archivo a la versión de `list_migrations`. Verificar con `execute_sql` que hay 9 filas y `prisma` tiene `sort_order = 9`. Reiniciar `npm run dev` (el catálogo está en `"use cache"` con `cacheLife("days")`) y comprobar que `/juegos/prisma` aparece con la partida simulada.
2. Añadir `.cover-prisma` en `app/globals.css` junto a las demás portadas: fondo `radial-gradient` violeta oscuro, un triángulo blanco translúcido centrado con `clip-path`, un haz blanco que entra por la izquierda y seis bandas de color (cian, magenta, amarillo, verde, naranja, violeta) que salen en abanico por la derecha. Verificar en la Biblioteca y el Detalle con `/frontend-design`.
3. Crear `components/games/playable.ts` con `PLAYABLE_GAMES` e `isPlayable`. Verificar con `npm run build`.
4. En `components/game-player.tsx`, si `isPlayable(game.id)`, sustituir `.game-arena` por `<PrismaGame key={runKey} ref={gameRef} paused={paused} … />` y mostrar `TIEMPO` (`m:ss`) y `ESPECTROS` en el HUD. El resto de juegos no cambian. Verificar jugando en `/juegos/prisma/jugar`.
5. Conectar los controles: PAUSA alterna `paused`; `onRequestPause` pone `paused = true`; FIN llama a `gameRef.current.finish()`; `onGameOver` fija la puntuación final y abre el modal; JUGAR DE NUEVO incrementa `runKey` y reinicia `hud`, `paused`, `over` y `saved`; GUARDAR PUNTUACIÓN usa `saveScore` de `lib/scores.ts` con la puntuación final. Verificar el ciclo completo.
6. Borrar `app/laboratorio/`. Actualizar `references/implemented-games.md` (9 juegos, PUZZLE 2, ficha de PRISMA) y la línea "8 games" de `CLAUDE.md`. Pasar `npm run lint` y `npm run build`.

---

## Criterios de aceptación

- [ ] `npm run build` y `npm run lint` terminan sin errores, y el build genera `/juegos/prisma` y `/juegos/prisma/jugar`.
- [ ] `list_migrations` muestra la migración `add_prisma_game` aplicada.
- [ ] `select id, category, color, sort_order from public.games where id = 'prisma'` devuelve `prisma`, `PUZZLE`, `magenta`, `9`.
- [ ] La Biblioteca muestra 9 juegos y el chip PUZZLE muestra CAÍDA y PRISMA.
- [ ] La tarjeta y el Detalle de PRISMA muestran la portada `cover-prisma` (prisma, haz blanco y seis bandas de color).
- [ ] `/juegos/prisma/jugar` muestra el tablero de canvas dentro del marco CRT, no la arena simulada.
- [ ] El HUD muestra `JUGADOR`, `PUNTUACIÓN`, `TIEMPO` y `ESPECTROS`, y se actualizan durante la partida.
- [ ] PAUSA oculta el tablero y detiene el reloj; REANUDAR lo continúa con el mismo tiempo.
- [ ] FIN abre el modal FIN DEL JUEGO con la puntuación final del juego.
- [ ] Al llegar el reloj a `0:00` se abre el modal FIN DEL JUEGO tras el rótulo `¡TIEMPO!`.
- [ ] GUARDAR PUNTUACIÓN añade a `localStorage["av_scores"]` una entrada con `game: "prisma"` y la puntuación del modal.
- [ ] JUGAR DE NUEVO empieza una partida nueva con tablero distinto, reloj a `1:30` y puntuación 0.
- [ ] Escribir en el input del modal (incluido `Espacio`) no mueve nada en el juego.
- [ ] SALIR vuelve a `/juegos/prisma` sin abrir el modal.
- [ ] Los otros 8 juegos siguen mostrando la partida simulada sin cambios.
- [ ] `/laboratorio/prisma` devuelve 404 en desarrollo y en producción.
- [ ] No hay errores en la consola del navegador en `/`, `/juegos/prisma` ni `/juegos/prisma/jugar`.

---

## Decisiones

- **Sí:** categoría `PUZZLE`. El catálogo solo tiene CAÍDA en PUZZLE y es un requisito del usuario.
- **Sí:** color `magenta`. Es el color menos usado del catálogo (solo CAÍDA) y queda 2 cian, 2 magenta, 2 amarillo, 3 verde.
- **No:** color `cyan`. Distinguiría mejor a PRISMA de CAÍDA en el filtro PUZZLE, pero desequilibra la paleta.
- **Sí:** `sort_order = 9`. Añade el juego al final sin reordenar el catálogo existente.
- **Sí:** `best = 0`, `plays = '0'`. Un récord inventado para un juego nuevo engañaría; SPEC 04 los calculará.
- **Sí:** registro `PLAYABLE_GAMES` por id. Prepara la integración de los siguientes juegos reales sin `if` repartidos.
- **No:** columna `playable` en `public.games`. El componente vive en el código; la base no sabe qué componente montar.
- **Sí:** remontar el juego con `key={runKey}` en JUGAR DE NUEVO. Reinicia todo el estado interno sin una API de reset.
- **Sí:** seguir usando `saveScore` (localStorage). SPEC 04 sustituirá esa función sin tocar PRISMA.
- **Sí:** portada solo en `app/globals.css`. `references/templates/styles.css` es el prototipo original y no contiene juegos nuevos.
- **No:** reutilizar `seededScores` con otra semilla para PRISMA. El leaderboard mock lo sigue generando como para los demás juegos hasta SPEC 04.

---

## Riesgos

| Riesgo                                                                          | Mitigación                                                                                        |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| El catálogo cacheado (`cacheLife("days")`) no muestra PRISMA tras la migración. | Reiniciar `next dev` o hacer un build nuevo; criterio de aceptación sobre la Biblioteca.          |
| El Detalle muestra un leaderboard mock con puntuaciones altas y `RÉCORD 0`.     | Aceptado hasta SPEC 04; se documenta en `references/implemented-games.md`.                        |
| `GamePlayer` crece demasiado con dos modos.                                     | Si supera unas 200 líneas, extraer el HUD del modo jugable a `components/games/playable-hud.tsx`. |
| El input del modal o los botones del HUD reciben teclas del juego.              | El juego escucha teclado solo en el canvas enfocado (spec 02); criterio de aceptación específico. |
| Puntuaciones falsificadas desde el navegador.                                   | Fuera de alcance; se tratará al diseñar SPEC 04.                                                  |

---

## Qué no está en este spec

- Puntuaciones reales, leaderboard y Salón desde Supabase (SPEC 04).
- Integración de Asteroids, Tetris o Arkanoid.
- Sonido.
- Validación antitrampas.
- Cambios en `references/templates/`.

Cada uno de esos puntos, si llega, va en su propia spec.
