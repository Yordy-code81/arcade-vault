# SPEC 01 — MVP visual: pantallas del vault

> **Status:** Implementado
> **Depends on:** —
> **Date:** 2026-11-10
> **Objective:** Portar a Next.js App Router las cinco pantallas de `references/templates/` (biblioteca, detalle, reproductor, acceso y salón de la fama) con datos mock y sin ningún juego real.

---

## Por qué existe esta spec

Los templates de `references/templates/` son un prototipo React 18 en UMD con Babel en el navegador y un router por hash.
El MVP necesita esas mismas pantallas como rutas reales de Next.js 16, con TypeScript estricto, para que las specs siguientes (juegos, backend, ranking real) se monten encima.
El tema visual ya está portado en `app/globals.css` (commit `b861969`); esta spec construye las pantallas sobre él.

---

## Alcance

**Dentro:**

- Cinco rutas App Router:
  - `/` → Biblioteca (hero, buscador, chips de categoría, grilla de tarjetas, estado "NO HAY RESULTADOS").
  - `/juegos/[id]` → Detalle (portada, tags, descripción larga, stat-strip, acciones, leaderboard de 10 filas).
  - `/juegos/[id]/jugar` → Reproductor simulado (HUD, arena CRT decorativa, puntuación que sube sola, PAUSA / FIN / SALIR, modal "FIN DEL JUEGO").
  - `/login` → Acceso (pestañas INICIAR SESIÓN / CREAR CUENTA, campo email solo en "crear", invitado, botones sociales decorativos).
  - `/salon-de-la-fama` → Salón de la Fama (pestañas por juego, podio top 3, tabla de 12 filas, fila "TU MEJOR MARCA" si hay sesión).
- Layout compartido: fondo (`av-bg`, `av-noise`), `Nav` con enlaces activos según la ruta, contador de créditos decorativo, botón de sesión, menú hamburguesa con panel móvil y footer `© 2026 ARCADE VAULT · HECHO CON PIXELES Y NEÓN · v2.6.0`.
- Datos mock tipados en `lib/data.ts` (8 juegos, categorías, generador determinista de puntuaciones).
- Sesión mock en `localStorage` (`av_user`): login con cualquier usuario, invitado, cerrar sesión desde el nav.
- Guardado de puntuación mock en `localStorage` (`av_scores`), sin leerlo en ninguna pantalla.
- Página 404 retro (`app/not-found.tsx`) para ids de juego inexistentes y rutas desconocidas.
- Revisión de `app/globals.css` para corregir clases que falten o no coincidan con los templates.
- Todo lo nuevo que no exista ya como clase en `globals.css` (incluidos los `style={{…}}` inline de los templates) se escribe con utilidades Tailwind.
- Diseño de cada pantalla aplicando la skill `/frontend-design` (requisito de `CLAUDE.md`), respetando la estética de los templates.

**Fuera de alcance (para specs futuras):**

- Cualquier juego jugable (lógica, canvas, controles).
- Autenticación real, validación de formularios, OAuth de Google / GitHub.
- Backend, base de datos o API de puntuaciones.
- Mostrar en el Salón o en el Detalle las puntuaciones guardadas en `av_scores`.
- Sistema real de créditos/monedas.
- Tests automatizados (no hay test runner configurado).

---

## Modelo de datos

Archivo `lib/data.ts`, importable desde server y client components (sin `"use client"`, sin APIs del navegador).

```ts
export type Category = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
export type CategoryFilter = "TODOS" | Category;
export type NeonColor = "cyan" | "magenta" | "yellow" | "green";

export interface Game {
  id: string;          // slug usado en /juegos/[id], p. ej. "bloque-buster"
  title: string;       // "BLOQUE BUSTER"
  short: string;       // descripción corta (tarjeta)
  long: string;        // descripción larga (detalle)
  cat: Category;
  cover: string;       // clase CSS de portada, p. ej. "cover-bricks"
  color: NeonColor;    // variante del botón JUGAR
  best: number;        // mejor puntuación global
  plays: string;       // "12.4K"
}

export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string;        // "DD/MM/2026"
}

export const GAMES: Game[];                 // los 8 juegos de data.jsx, mismo contenido
export const CATEGORIES: CategoryFilter[];  // ["TODOS","ARCADE","PUZZLE","SHOOTER","VERSUS"]
export function getGame(id: string): Game | undefined;
export function seededScores(seed: number, count?: number): ScoreRow[]; // mismo algoritmo que data.jsx
```

Archivo `lib/session.ts` (client-only):

```ts
export interface SessionUser { name: string } // MAYÚSCULAS, máx. 10 caracteres

// Clave localStorage: "av_user" → JSON de SessionUser | null
export function useSession(): SessionUser | null; // useSyncExternalStore, snapshot de servidor = null
export function signIn(user: SessionUser): void;
export function signOut(): void;
```

Archivo `lib/scores.ts` (client-only):

```ts
export interface SavedScore { game: string; score: number; name: string; at: number }
// Clave localStorage: "av_scores" → JSON de SavedScore[]
export function saveScore(entry: Omit<SavedScore, "at">): void;
```

Convenciones:

- Semillas iguales a los templates: Detalle usa `seededScores(id.length * 17 + 3, 10)`; Salón usa `seededScores(id.length * 23 + 7, 12)`.
- Números formateados con `toLocaleString("es-ES")`.
- Todo acceso a `localStorage` va envuelto en `try/catch`.

---

## Estructura de archivos

```text
app/
  layout.tsx                    (modificado: Nav + <main className="av-main"> + Footer)
  page.tsx                      (modificado: Biblioteca)
  not-found.tsx                 (nuevo)
  login/page.tsx                (nuevo)
  salon-de-la-fama/page.tsx     (nuevo)
  juegos/[id]/page.tsx          (nuevo, generateStaticParams sobre GAMES)
  juegos/[id]/jugar/page.tsx    (nuevo, generateStaticParams sobre GAMES)
  globals.css                   (revisado si hace falta)
components/
  nav.tsx                       ("use client": usePathname, panel móvil, sesión)
  footer.tsx
  game-card.tsx                 ("use client": efecto tilt con el ratón)
  library.tsx                   ("use client": búsqueda + chips + grilla)
  leaderboard.tsx               (server: lista de ScoreRow del detalle)
  auth-form.tsx                 ("use client")
  game-player.tsx               ("use client": simulación + modal)
  hall-of-fame.tsx              ("use client": pestañas, podio, tabla)
lib/
  data.ts
  session.ts
  scores.ts
```

---

## Plan de implementación

1. Crear `lib/data.ts` con los tipos, `GAMES`, `CATEGORIES`, `getGame` y `seededScores`. Verificar con `npm run build`.
2. Crear `lib/session.ts` y `lib/scores.ts`. Verificar con `npm run build`.
3. Crear `components/nav.tsx` y `components/footer.tsx`, y montarlos en `app/layout.tsx` con `<main className="av-main">`. Mover el `<main>` fuera de `app/page.tsx`. Prueba manual: `npm run dev`, el nav y el footer aparecen en `/`.
4. Implementar la Biblioteca: `components/game-card.tsx`, `components/library.tsx` y `app/page.tsx`. Prueba manual: filtrar por texto y por categoría; una búsqueda sin coincidencias muestra "NO HAY RESULTADOS".
5. Implementar el Detalle: `components/leaderboard.tsx` y `app/juegos/[id]/page.tsx` (`params` es una Promise en Next 16; `notFound()` si `getGame` devuelve `undefined`). Crear `app/not-found.tsx`. Prueba manual: `/juegos/caida` muestra el detalle, `/juegos/xyz` muestra el 404 retro.
6. Implementar el Acceso: `components/auth-form.tsx` y `app/login/page.tsx`. Prueba manual: entrar con "px_kai" redirige a `/` y el nav muestra `PX_KAI ▾`; pulsarlo cierra sesión.
7. Implementar el Reproductor: `components/game-player.tsx` y `app/juegos/[id]/jugar/page.tsx`. Prueba manual: la puntuación sube, PAUSA la congela, FIN abre el modal, GUARDAR escribe en `av_scores` y muestra el toast, JUGAR DE NUEVO reinicia.
8. Implementar el Salón: `components/hall-of-fame.tsx` y `app/salon-de-la-fama/page.tsx`. Prueba manual: cambiar de pestaña cambia podio y tabla; con sesión aparece la fila "TU MEJOR MARCA".
9. Revisar `app/globals.css` contra `references/templates/styles.css` y ajustar diferencias visuales encontradas en los pasos 3–8. Pasar `npm run lint` y `npm run build`.

---

## Criterios de aceptación

- [ ] `npm run build` termina sin errores de tipos ni de prerender.
- [ ] `npm run lint` termina sin errores.
- [ ] `/`, `/juegos/[id]` (8 ids), `/juegos/[id]/jugar` (8 ids), `/login` y `/salon-de-la-fama` cargan sin errores en la consola del navegador.
- [ ] La Biblioteca muestra 8 tarjetas al cargar.
- [ ] Escribir "ca" en el buscador deja solo las tarjetas cuyo título contiene "ca" (sin distinguir mayúsculas).
- [ ] El chip "SHOOTER" deja exactamente 2 tarjetas (INVASORES y ROCAS).
- [ ] Una búsqueda sin coincidencias muestra "NO HAY RESULTADOS".
- [ ] Clicar una tarjeta o su botón JUGAR navega a `/juegos/<id>`.
- [ ] El Detalle muestra título, descripción larga, partidas, mejor global y 10 filas de leaderboard con top 1/2/3 resaltados.
- [ ] "JUGAR AHORA" navega a `/juegos/<id>/jugar`; "VOLVER AL VAULT" navega a `/`.
- [ ] `/juegos/no-existe` y `/ruta-cualquiera` muestran la página 404 retro con un botón que lleva a `/`.
- [ ] En el Reproductor la puntuación aumenta sola; PAUSA la detiene y muestra "EN PAUSA"; REANUDAR la continúa.
- [ ] FIN abre el modal "FIN DEL JUEGO" con la puntuación final.
- [ ] GUARDAR PUNTUACIÓN añade una entrada a `localStorage["av_scores"]` y muestra "▸ PUNTUACIÓN GUARDADA_".
- [ ] JUGAR DE NUEVO reinicia puntuación a 0, vidas a 3 y nivel a 01.
- [ ] SALIR navega al detalle del juego.
- [ ] En `/login`, la pestaña CREAR CUENTA muestra el campo de correo y la pestaña INICIAR SESIÓN lo oculta.
- [ ] Enviar el formulario guarda `av_user`, redirige a `/` y el nav muestra el nombre en mayúsculas (máx. 10 caracteres).
- [ ] Enviar con el usuario vacío inicia sesión como "PLAYER1".
- [ ] "JUGAR COMO INVITADO" deja la sesión en `null` y redirige a `/`.
- [ ] Pulsar el nombre en el nav cierra la sesión y vuelve a mostrar "Iniciar Sesión".
- [ ] Recargar la página conserva la sesión.
- [ ] El enlace del nav "Biblioteca" está activo en `/`, `/juegos/*`; "Salón de la Fama" está activo en `/salon-de-la-fama`.
- [ ] Con ancho < 768 px el botón ≡ abre el panel móvil y clicar el fondo lo cierra.
- [ ] El Salón muestra una pestaña por juego (8), podio con plata–oro–bronce y tabla de 12 filas.
- [ ] Con sesión iniciada, el Salón muestra la fila "▸ TU MEJOR MARCA EN <JUEGO>"; sin sesión no aparece.
- [ ] Ningún componente nuevo usa `style={{…}}` para algo que pueda expresarse con utilidades Tailwind o clases de `globals.css`.

---

## Decisiones

- **Sí:** rutas App Router en español (`/juegos/[id]`, `/juegos/[id]/jugar`, `/login`, `/salon-de-la-fama`). URLs reales y compartibles, coherentes con la UI en español.
- **No:** router por hash con JSON del template. Incompatible con el App Router y con el prerender.
- **No:** rutas en inglés. La UI y el README están en español.
- **Sí:** `generateStaticParams` sobre `GAMES` en detalle y reproductor. Los 8 juegos son estáticos y encajan con `cacheComponents`.
- **Sí:** sesión mock en `localStorage["av_user"]` leída con `useSyncExternalStore`. Da estado compartido entre nav, reproductor y salón sin un Context y sin errores de hidratación.
- **No:** autenticación real. Esta spec es solo visual.
- **Sí:** el reproductor replica la simulación del template y guarda en `localStorage["av_scores"]`. Deja el flujo completo listo para cuando existan juegos reales.
- **No:** leer `av_scores` en el Salón o el Detalle. Los rankings siguen siendo mock; mostrar puntuaciones reales va en otra spec.
- **Sí:** reutilizar las clases ya portadas en `app/globals.css` y usar Tailwind para todo lo demás. La revisión de `globals.css` está permitida si se detectan diferencias.
- **No:** reescribir todo `globals.css` en utilidades Tailwind. Mucho trabajo y riesgo de desviarse del diseño.
- **Sí:** datos mock en `lib/data.ts` tipado. Importable desde server y client components.
- **No:** JSON en `data/games.json`. `seededScores` sigue necesitando TS; separar no aporta nada ahora.
- **Sí:** componentes compartidos en `components/` en la raíz, importados con `@/components/…`.
- **Sí:** `notFound()` + `app/not-found.tsx` retro. El template devuelve `null` para ids desconocidos, lo que deja una pantalla vacía.
- **Sí:** el nombre de la marca es "Arcade Vault". "Arcade Bot" en el prompt inicial fue un error de tipeo.
- **Sí:** pestañas del Salón y filtros de la Biblioteca como estado de cliente, no como `searchParams`. Evita volver dinámicas esas rutas y añadir `<Suspense>` solo por un filtro.

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| El nav muestra "Iniciar Sesión" un instante antes de leer `av_user` (snapshot de servidor `null`). | Aceptado en el MVP. `useSyncExternalStore` evita el error de hidratación; el parpadeo es de un frame. |
| `usePathname` en el nav dentro del layout con `cacheComponents` exige `<Suspense>` en rutas dinámicas. | Si `npm run build` lo reclama, envolver `<Nav>` en `<Suspense>` con un fallback que pinte el nav sin enlace activo. |
| APIs de Next 16 distintas a las conocidas (`params` como Promise, `generateStaticParams` con `cacheComponents`). | Consultar `node_modules/next/dist/docs/01-app/` antes de escribir cada página, como exige `AGENTS.md`. |
| `localStorage` bloqueado (modo privado, cookies desactivadas). | Todo acceso en `try/catch`; la sesión cae a `null` y guardar puntuación no hace nada, sin romper la UI. |
| El efecto tilt de `GameCard` manipula `style.transform` directamente. | Se permite como excepción al criterio de "sin `style` inline": es un valor calculado en cada `mousemove`. |

---

## Lo que **no** está en esta spec

- Ningún juego jugable.
- Autenticación real ni OAuth.
- Backend, base de datos o API de puntuaciones.
- Rankings construidos a partir de `av_scores`.
- Créditos/monedas funcionales.
- Tests automatizados.

Cada uno de esos puntos, si llega, va en su propia spec.
