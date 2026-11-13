# SPEC — PRISMA: motor y lienzo jugable

> **Estado:** Borrador
> **Depende de:** SPEC 01, SPEC 03, `specs/game-jam/prisma/01-diseno-juego.md`
> **Fecha:** 2026-11-13
> **Objetivo:** Implementar PRISMA como componente React de canvas autónomo (motor puro + render + entrada) jugable en una página de laboratorio solo de desarrollo.

---

## Por qué existe esta spec

Es el primer juego real de Arcade Vault; hasta ahora el Reproductor solo simula partidas.
Se separa en dos specs para que el motor se pueda probar sin tocar el catálogo de Supabase.
Esta spec deja el juego jugable en `/laboratorio/prisma` (solo `next dev`).
La integración en el catálogo y el Reproductor está en `03-integracion-plataforma.md`.

---

## Alcance

**Dentro:**

- Motor puro en TypeScript `lib/games/prisma/engine.ts`: tablero, detección de líneas, puntuación, gravedad, relleno, movimientos válidos, pista y rebarajado.
- Generador aleatorio inyectable con semilla `lib/games/prisma/rng.ts`.
- Constantes del juego en `lib/games/prisma/constants.ts`.
- Render de canvas `lib/games/prisma/render.ts`: tablero, prismas, efectos, barra de tiempo, panel ESPECTRO y pantallas de inicio, pausa y fin.
- Componente cliente `components/games/prisma-game.tsx` con bucle `requestAnimationFrame`, máquina de fases, reloj de 90 s, entrada por puntero (ratón/táctil) y teclado.
- API del componente pensada para el Reproductor: props `paused`, `onHud`, `onGameOver`, `onRequestPause`, `seed` y un `ref` con `finish()`.
- Página de laboratorio `app/laboratorio/prisma/page.tsx` que solo existe en desarrollo.

**Fuera de alcance (para specs futuras):**

- Fila en `public.games`, portada `cover-prisma` y montaje en `components/game-player.tsx` (spec `03-integracion-plataforma.md`).
- Puntuaciones reales en Supabase (SPEC 04).
- Sonido.
- Piezas especiales, niveles, semilla diaria.
- Tests automatizados (no hay test runner en el repo).

---

## Modelo de datos

### Constantes — `lib/games/prisma/constants.ts`

```ts
export const COLS = 8;
export const ROWS = 8;
export const COLOR_COUNT = 6;
export const GAME_MS = 90_000;
export const CRITICAL_MS = 10_000;
export const CRITICAL_MULT = 2;
export const POINTS_PER_PIECE = 10;
export const LINE_BONUS_4 = 40;
export const LINE_BONUS_5_PLUS = 100;
export const MAX_CASCADE_MULT = 5;
export const SPECTRUM_BONUS = 500;
export const HINT_AFTER_MS = 8_000;
export const SWAP_MS = 120;
export const CLEAR_MS = 180;
export const FALL_MS_PER_CELL = 60;
export const SHUFFLE_MS = 600;
export const TIME_UP_MS = 800;
export const MAX_FRAME_MS = 100; // dt clamp per frame
export const MAX_INSTANT_STEPS = 50; // safety cap when resolving at time 0
export const MAX_SHUFFLE_TRIES = 100;
export const DRAG_THRESHOLD = 0.4; // fraction of a cell

// Canvas layout (logical px, 640x480 = 4:3 like .crt-screen)
export const CANVAS_W = 640;
export const CANVAS_H = 480;
export const BOARD_X = 32;
export const BOARD_Y = 32;
export const CELL = 52;

export const PRISM_COLORS = [
  "#00f5ff",
  "#ff006e",
  "#f5ff00",
  "#00ff88",
  "#ff7700",
  "#aa00ff",
] as const;
export const PRISM_SHAPES = [
  "triangle",
  "rhombus",
  "hexagon",
  "square",
  "pentagon",
  "octagon",
] as const;
```

### Tipos del motor — `lib/games/prisma/engine.ts`

```ts
export type PrismColor = 0 | 1 | 2 | 3 | 4 | 5;
export type Board = (PrismColor | null)[][]; // board[row][col], null = hueco durante la caída
export interface Cell {
  row: number;
  col: number;
}
export interface Line {
  color: PrismColor;
  dir: "h" | "v";
  cells: Cell[];
} // cells.length >= 3

export interface StepResult {
  cleared: Cell[]; // unión sin duplicados
  lines: Line[];
  points: number; // ya multiplicado
  colorsHit: PrismColor[];
}

export interface FallMove {
  from: number | null;
  to: Cell;
  color: PrismColor;
} // from=null: entra por arriba
```

Funciones puras del motor (firmas; ninguna toca el DOM):

```ts
createBoard(rng: Rng): Board                          // sin líneas y con >= 1 movimiento
findLines(board: Board): Line[]
scoreStep(lines: Line[], cleared: number, step: number, critical: boolean): number
swap(board: Board, a: Cell, b: Cell): Board           // copia
isAdjacent(a: Cell, b: Cell): boolean
isValidSwap(board: Board, a: Cell, b: Cell): boolean
clearCells(board: Board, cells: Cell[]): Board
collapse(board: Board, rng: Rng): { board: Board; moves: FallMove[] }
findHint(board: Board): [Cell, Cell] | null            // null = sin movimientos
shuffle(board: Board, rng: Rng): Board                 // mismos colores, sin líneas, con movimiento
```

### Estado del juego (en un `useRef`, no en estado React)

```ts
type Phase =
  | "ready"
  | "idle"
  | "swapping"
  | "reverting"
  | "clearing"
  | "falling"
  | "shuffling"
  | "timeUp"
  | "over";

interface PrismaState {
  board: Board;
  phase: Phase;
  phaseMs: number; // tiempo transcurrido en la fase actual
  timeLeftMs: number; // 90_000 → 0
  score: number;
  step: number; // paso de cascada actual (1..n), 0 en idle
  spectrum: boolean[]; // 6 ranuras
  spectra: number; // LUZ BLANCA conseguidas
  cursor: Cell; // cursor de teclado, empieza en { row: 3, col: 3 }
  selected: Cell | null; // selección por puntero
  grabbed: Cell | null; // prisma agarrado por teclado
  pendingSwap: [Cell, Cell] | null;
  pendingStep: StepResult | null;
  falls: FallMove[];
  idleMs: number; // para la pista
  hint: [Cell, Cell] | null;
  effects: Effect[]; // esquirlas, textos flotantes, barrido LUZ BLANCA
}
```

### API del componente — `components/games/prisma-game.tsx`

```ts
export interface PrismaHud {
  score: number;
  timeLeftMs: number;
  spectra: number;
}

export interface PrismaGameHandle {
  finish(): void;
}

interface PrismaGameProps {
  paused: boolean;
  seed?: number; // fija el aleatorio (laboratorio)
  onHud(hud: PrismaHud): void; // solo cuando cambia score, spectra o el segundo entero
  onGameOver(result: { score: number }): void;
  onRequestPause(): void; // tecla P, pestaña oculta o ventana sin foco
  ref?: React.Ref<PrismaGameHandle>; // React 19: ref como prop
}
```

Convenciones:

- Coordenadas con origen arriba a la izquierda; `row` crece hacia abajo.
- Tiempos en milisegundos; `dt` de cada frame recortado a `MAX_FRAME_MS`.
- Toda la puntuación son enteros; nunca hay decimales.
- `Rng` es `() => number` en `[0, 1)`; por defecto `Math.random`, con `seed` usa mulberry32.

---

## Reglas de implementación clave

### Puntuación

- `scoreStep = (cleared × POINTS_PER_PIECE + Σ bonus) × min(step, MAX_CASCADE_MULT) × (critical ? CRITICAL_MULT : 1)`.
- Bonus por línea: longitud 3 → 0, longitud 4 → `LINE_BONUS_4`, longitud ≥ 5 → `LINE_BONUS_5_PLUS`.
- `critical` es `timeLeftMs <= CRITICAL_MS` en el momento de resolver el paso.
- Tras sumar el paso se encienden las ranuras de `colorsHit`; si las seis quedan encendidas se suma `SPECTRUM_BONUS`, se incrementa `spectra` y se apagan todas.

### Fases y reloj

| Fase        | Reloj corre | Entrada de intercambio | Sale a                                       |
| ----------- | ----------- | ---------------------- | -------------------------------------------- |
| `ready`     | No          | Solo empezar           | `idle`                                       |
| `idle`      | Sí          | Sí                     | `swapping`                                   |
| `swapping`  | Sí          | No                     | `clearing` (válido) o `reverting`            |
| `reverting` | Sí          | No                     | `idle`                                       |
| `clearing`  | Sí          | No                     | `falling`                                    |
| `falling`   | Sí          | No                     | `clearing` (hay líneas) o `idle`/`shuffling` |
| `shuffling` | No          | No                     | `idle`                                       |
| `timeUp`    | No          | No                     | `over` tras `TIME_UP_MS`                     |
| `over`      | No          | No                     | —                                            |

- Con `paused = true` no avanzan ni el reloj ni las animaciones.
- Cuando `timeLeftMs` llega a 0 (o se llama a `finish()`) se ejecuta la resolución instantánea descrita en el diseño, se fija `timeLeftMs = 0`, se pasa a `timeUp` y, al terminar, se llama una única vez a `onGameOver({ score })`.
- La resolución instantánea reutiliza `findLines` / `scoreStep` / `clearCells` / `collapse` en bucle, hasta tablero estable o `MAX_INSTANT_STEPS`.

### Entrada

- Puntero: Pointer Events sobre el `<canvas>` con `touch-action: none`; la posición se convierte a celda con `getBoundingClientRect()` escalado a 640 × 480.
- Arrastre: si el desplazamiento desde `pointerdown` supera `DRAG_THRESHOLD × CELL` (en px lógicos), se intenta el intercambio en el eje dominante y se ignora el resto del gesto.
- Teclado: `keydown` registrado sobre el `<canvas>` (`tabIndex = 0`), no sobre `window`, para no capturar teclas de los botones del HUD ni del modal.
- Se hace `preventDefault()` en flechas, `Espacio` y `Enter` para que la página no haga scroll.
- El canvas recibe `focus()` al montar, al empezar y al reanudar.
- `visibilitychange` (oculto) y `blur` de `window` llaman a `onRequestPause()` si la fase es de juego.

---

## Estructura de archivos

```text
lib/
  games/
    prisma/
      constants.ts        (nuevo)
      rng.ts              (nuevo)
      engine.ts           (nuevo)
      render.ts           (nuevo)
components/
  games/
    prisma-game.tsx       (nuevo, "use client")
app/
  laboratorio/
    prisma/
      page.tsx            (nuevo, solo desarrollo; se borra en la spec 03)
      lab.tsx             (nuevo, "use client": envoltorio con HUD de texto y botón de pausa)
```

---

## Plan de implementación

1. Crear `lib/games/prisma/constants.ts` y `lib/games/prisma/rng.ts` (`createRng(seed?: number): Rng` con mulberry32 o `Math.random`). Verificar con `npm run build`.
2. En `engine.ts`: tipos, `findLines`, `isAdjacent`, `swap`, `isValidSwap` y `scoreStep`. Verificar con `npm run build`.
3. En `engine.ts`: `createBoard` (exclusión de colores izquierda/arriba, reintento si no hay movimiento) y `findHint` (prueba los intercambios derecha y abajo de cada celda). Verificar con `npm run build`.
4. En `engine.ts`: `clearCells`, `collapse` (gravedad por columna y relleno aleatorio, devolviendo `FallMove[]`) y `shuffle` (Fisher-Yates hasta `MAX_SHUFFLE_TRIES`, después `createBoard`). Verificar con `npm run build`.
5. Crear `app/laboratorio/prisma/page.tsx` (llama a `notFound()` si `process.env.NODE_ENV === "production"`) y `lab.tsx`, que de momento pinta el tablero de `createBoard(createRng(1234))` como texto. Probar `/laboratorio/prisma` en `npm run dev`.
6. Crear `render.ts` con `drawBoard`, `drawPrism` (las seis formas), fondo, rejilla, barra de tiempo y panel ESPECTRO estático. Crear `prisma-game.tsx` con canvas 640 × 480 escalado por `devicePixelRatio` y bucle rAF que solo dibuja. Montarlo en `lab.tsx`. Ver el tablero en el navegador.
7. Añadir fases `ready` → `idle`, reloj de 90 s con `dt` recortado y `onHud`. Pantalla de inicio. Verificar en el laboratorio que el reloj baja de `1:30` a `0:00`.
8. Añadir entrada por puntero (selección, clic adyacente, arrastre) y fases `swapping` / `reverting` con sus animaciones. Verificar intercambios válidos e inválidos.
9. Añadir `clearing` y `falling` con cascadas, puntuación, espectro, LUZ BLANCA y textos flotantes. Verificar los ejemplos de la tabla de puntuación del diseño.
10. Añadir teclado (cursor, agarrar, soltar, `Esc`, `P`) y el `preventDefault` de flechas y espacio.
11. Añadir comprobación de movimientos tras tablero estable, fase `shuffling` y pista a los 8 s.
12. Añadir fin de partida: resolución instantánea a 0 s, `finish()` por `ref`, fase `timeUp`, `onGameOver` único y fase crítica (×2 y latido magenta).
13. Añadir pausa: prop `paused`, tablero oculto, `onRequestPause` en `P`, `visibilitychange` y `blur`. Pasar `npm run lint` y `npm run build`.

---

## Criterios de aceptación

- [ ] `npm run build` y `npm run lint` terminan sin errores.
- [ ] `/laboratorio/prisma` muestra el juego en `npm run dev` y devuelve 404 en `npm run build && npm run start`.
- [ ] El tablero es de 8 × 8 con 6 colores, cada uno con su forma.
- [ ] El tablero inicial no tiene ninguna línea de 3 o más y tiene al menos un movimiento válido (comprobado con 20 recargas).
- [ ] El reloj no corre en la pantalla de inicio y empieza en `1:30` al pulsar `Espacio` o tocar.
- [ ] Intercambiar dos prismas no adyacentes es imposible; un clic en un prisma no adyacente mueve la selección.
- [ ] Un intercambio que no forma línea se revierte en 240 ms y la puntuación no cambia.
- [ ] Una línea de 3 sin cascada suma exactamente 30; una de 4, 80; una de 5, 150.
- [ ] El segundo paso de una cascada muestra `CASCADA ×2` y duplica sus puntos.
- [ ] Al romper prismas de los seis colores (en uno o varios pasos) se suma exactamente 500 una vez y las seis ranuras se apagan.
- [ ] Con 10 s o menos, los puntos de paso se duplican y la barra de tiempo es magenta.
- [ ] Sin movimientos posibles aparece `SIN MOVIMIENTOS · REBARAJANDO`, el reloj se detiene 600 ms y el tablero resultante tiene un movimiento válido.
- [ ] Tras 8 s sin intercambiar, dos prismas de un movimiento válido laten.
- [ ] Ratón: clic + clic adyacente y arrastre intercambian; táctil (emulación móvil de Playwright o DevTools) igual, sin scroll de página.
- [ ] Teclado: flechas y `WASD` mueven el cursor; `Espacio` + flecha intercambia; `Esc` suelta; las flechas no desplazan la página.
- [ ] Si el reloj llega a 0 durante una cascada, sus puntos se suman y `onGameOver` se llama una sola vez con la puntuación final.
- [ ] Un intercambio inválido en curso al llegar a 0 no suma puntos.
- [ ] `finish()` termina la partida con las mismas reglas que el reloj a 0.
- [ ] En pausa el tablero no es visible y el reloj no avanza; ocultar la pestaña pide la pausa.
- [ ] Con `seed = 1234` el tablero inicial es idéntico en dos recargas.
- [ ] No hay errores en la consola del navegador durante una partida completa.

---

## Decisiones

- **Sí:** motor en funciones puras separadas del render. Permite razonar y probar la puntuación sin canvas y reutilizar la resolución instantánea.
- **Sí:** estado del juego en `useRef` y `onHud` limitado a cambios. Evita un render de React por frame.
- **Sí:** canvas lógico 640 × 480. Coincide con el `aspect-ratio: 4 / 3` de `.crt-screen` y no deforma el tablero.
- **Sí:** TypeScript dentro del repo, no un `game.js` vanilla en `public/`. El repo es TS estricto con lint; los juegos de `references/started-games/` son solo referencia de estilo.
- **Sí:** `Rng` inyectable con semilla opcional. Hace reproducible el laboratorio; las partidas reales usan `Math.random`.
- **No:** semilla en partidas reales. Daría tableros memorizables para el leaderboard.
- **Sí:** el reloj sigue corriendo durante las animaciones de cascada. Es la regla habitual de contrarreloj y premia jugar rápido.
- **Sí:** el reloj se detiene durante el rebarajado. El jugador no lo ha provocado.
- **Sí:** a 0 s la cascada en curso se resuelve al instante y cuenta. Es lo justo con una jugada aceptada antes del final y no alarga la partida.
- **No:** animar la cascada final. Alargaría la partida más allá de 90 s visibles.
- **Sí:** teclado escuchado en el canvas con foco. No secuestra `Espacio` en botones del HUD ni en el input del modal.
- **Sí:** página de laboratorio con `notFound()` en producción. Es la forma más barata de jugar el motor antes de tocar el catálogo; se borra en la spec 03.
- **No:** ruta de laboratorio permanente. Expondría una URL no prevista en la plataforma.
- **Sí:** `dt` recortado a 100 ms y pausa automática al ocultar la pestaña. Evita que un frame largo se coma segundos del reloj.
- **No:** piezas especiales. Ver "Qué no entra" del diseño.

---

## Riesgos

| Riesgo                                                                 | Mitigación                                                                                                        |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Reglas de lint de React 19 (`react-hooks`) sobre mutar refs en render. | Mutar el estado solo dentro del bucle rAF y de los manejadores, nunca durante el render.                          |
| Coordenadas de puntero mal escaladas con DPR o CSS `width: 100%`.      | Convertir siempre con `getBoundingClientRect()` a 640 × 480 lógicos; DPR solo afecta al tamaño del backing store. |
| Cascadas infinitas teóricas en la resolución instantánea.              | Tope `MAX_INSTANT_STEPS = 50`.                                                                                    |
| `shuffle` sin solución con ciertos repartos de colores.                | Tras `MAX_SHUFFLE_TRIES` se genera un tablero nuevo con `createBoard`.                                            |
| `onGameOver` llamado dos veces (reloj a 0 y `finish()` a la vez).      | Guardia: solo se emite al pasar de `timeUp` a `over`, una vez.                                                    |
| El laboratorio se queda en el repo por olvido.                         | Su borrado es un paso explícito y un criterio de aceptación de la spec 03.                                        |
| APIs de Next 16 distintas para páginas y `notFound`.                   | Consultar `node_modules/next/dist/docs/01-app/` antes del paso 5, como exige `AGENTS.md`.                         |

---

## Qué no está en este spec

- Fila de PRISMA en `public.games`, portada y montaje en el Reproductor (spec `03-integracion-plataforma.md`).
- Puntuaciones en Supabase (SPEC 04).
- Sonido.
- Piezas especiales, niveles, semilla diaria.
- Tests automatizados.

Cada uno de esos puntos, si llega, va en su propia spec.
