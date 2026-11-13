# Juegos implementados

> **Fuente:** tabla `public.games` de Supabase (SPEC 03), consultada el 2026-11-13.
> **Total:** 8 juegos.

Estos son los juegos del catálogo que muestra Arcade Vault (Biblioteca, Detalle, Reproductor y Salón de la Fama).

> **Importante:** por ahora ninguno es jugable de verdad. El Reproductor (`/juegos/<id>/jugar`) solo simula una partida con una puntuación que sube sola. Las cifras de **Récord** y **Partidas** también son datos de prueba hasta la SPEC 04 (puntuaciones reales). Los juegos jugables que existen como referencia (`references/started-games/`: Asteroids, Tetris y Arkanoid) aún no están integrados en la app.

## Resumen

| #   | ID              | Título        | Categoría | Color   | Récord  | Partidas | Ruta                    |
| --- | --------------- | ------------- | --------- | ------- | ------- | -------- | ----------------------- |
| 1   | `bloque-buster` | BLOQUE BUSTER | ARCADE    | cyan    | 28.450  | 12.4K    | `/juegos/bloque-buster` |
| 2   | `caida`         | CAÍDA         | PUZZLE    | magenta | 184.220 | 31.8K    | `/juegos/caida`         |
| 3   | `serpentina`    | SERPENTINA    | ARCADE    | green   | 7.820   | 9.1K     | `/juegos/serpentina`    |
| 4   | `gloton`        | GLOTÓN        | ARCADE    | yellow  | 96.400  | 27.2K    | `/juegos/gloton`        |
| 5   | `invasores`     | INVASORES     | SHOOTER   | green   | 54.190  | 18.0K    | `/juegos/invasores`     |
| 6   | `rocas`         | ROCAS         | SHOOTER   | yellow  | 41.200  | 15.6K    | `/juegos/rocas`         |
| 7   | `ranaria`       | RANARIA       | ARCADE    | green   | 18.900  | 6.4K     | `/juegos/ranaria`       |
| 8   | `duelo-pixel`   | DUELO PIXEL   | VERSUS    | cyan    | 24      | 4.2K     | `/juegos/duelo-pixel`   |

Por categoría: **ARCADE** 4 · **SHOOTER** 2 · **PUZZLE** 1 · **VERSUS** 1.

## Fichas

### 1. BLOQUE BUSTER

- **ID:** `bloque-buster` · **Categoría:** ARCADE · **Color:** cyan · **Portada:** `cover-bricks`
- **Récord:** 28.450 · **Partidas:** 12.4K
- **Resumen:** Rebota la pelota y destruye muros de neón.
- **Descripción:** Pilota una nave-paleta y rebota un núcleo de plasma para pulverizar muros de bloques cromáticos. Cada nivel reorganiza la grilla en patrones imposibles. ¿Hasta dónde llegará tu racha?

### 2. CAÍDA

- **ID:** `caida` · **Categoría:** PUZZLE · **Color:** magenta · **Portada:** `cover-tetro`
- **Récord:** 184.220 · **Partidas:** 31.8K
- **Resumen:** Encaja las piezas antes de que el techo te aplaste.
- **Descripción:** Piezas geométricas descienden desde la oscuridad. Rótalas, encástralas y limpia líneas para sobrevivir. La velocidad aumenta sin piedad cada 10 líneas.

### 3. SERPENTINA

- **ID:** `serpentina` · **Categoría:** ARCADE · **Color:** green · **Portada:** `cover-snake`
- **Récord:** 7.820 · **Partidas:** 9.1K
- **Resumen:** Crece sin morder tu propia cola.
- **Descripción:** Una serpiente de luz recorre la grilla buscando núcleos magenta. Cada bocado la alarga y la hace más veloz. Un movimiento en falso y se devora a sí misma.

### 4. GLOTÓN

- **ID:** `gloton` · **Categoría:** ARCADE · **Color:** yellow · **Portada:** `cover-glot`
- **Récord:** 96.400 · **Partidas:** 27.2K
- **Resumen:** Devora puntos y escapa de los fantasmas.
- **Descripción:** Un círculo glotón patrulla un laberinto coleccionando puntos luminosos. Cuatro espectros lo persiguen, pero cada cierto tiempo aparece una píldora que invierte los papeles.

### 5. INVASORES

- **ID:** `invasores` · **Categoría:** SHOOTER · **Color:** green · **Portada:** `cover-invaders`
- **Récord:** 54.190 · **Partidas:** 18.0K
- **Resumen:** Defiende el planeta de filas alienígenas.
- **Descripción:** Olas de pixeles hostiles descienden formación tras formación. Mueve tu cañón en horizontal y abre fuego con precisión, antes de que toquen la superficie.

### 6. ROCAS

- **ID:** `rocas` · **Categoría:** SHOOTER · **Color:** yellow · **Portada:** `cover-rocas`
- **Récord:** 41.200 · **Partidas:** 15.6K
- **Resumen:** Pulveriza asteroides en gravedad cero.
- **Descripción:** Tu nave triangular flota en vacío absoluto. Dispara y rota para dividir rocas en fragmentos cada vez más pequeños. Cuidado con los OVNIs en el horizonte.

### 7. RANARIA

- **ID:** `ranaria` · **Categoría:** ARCADE · **Color:** green · **Portada:** `cover-rana`
- **Récord:** 18.900 · **Partidas:** 6.4K
- **Resumen:** Cruza la autopista de pixeles.
- **Descripción:** Salta entre carriles de coches a toda velocidad y troncos a la deriva en el río. Llega a los nenúfares antes de que se acabe el tiempo.

### 8. DUELO PIXEL

- **ID:** `duelo-pixel` · **Categoría:** VERSUS · **Color:** cyan · **Portada:** `cover-duelo`
- **Récord:** 24 · **Partidas:** 4.2K
- **Resumen:** Dos paletas. Una pelota. Reflejos máximos.
- **Descripción:** El duelo más puro: dos paletas verticales se enfrentan por rebotar una pelota luminosa. Modo solitario contra la CPU o partida local a dos jugadores.

## Cómo regenerar este archivo

Consulta la tabla con el MCP de Supabase y actualiza las secciones de arriba:

```sql
select id, title, category, color, cover, best, plays, short_desc, long_desc
from public.games
order by sort_order;
```

El catálogo solo cambia mediante migraciones en `supabase/migrations/`.
