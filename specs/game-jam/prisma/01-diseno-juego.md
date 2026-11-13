# PRISMA — Diseño de juego

> **Estado:** Borrador
> **Fecha:** 2026-11-13
> **Tema:** Prisma
> **Objetivo:** Un match-3 por intercambio de prismas de neón en una rejilla 8×8, contrarreloj de 90 s, donde recomponer el espectro completo de la luz da el bonus más alto.

---

## Ficha de catálogo

| Campo        | Valor                                                                                                                                                                                                                   |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`         | `prisma`                                                                                                                                                                                                                |
| `title`      | `PRISMA`                                                                                                                                                                                                                |
| `category`   | `PUZZLE`                                                                                                                                                                                                                |
| `color`      | `magenta`                                                                                                                                                                                                               |
| `cover`      | `cover-prisma`                                                                                                                                                                                                          |
| `short_desc` | Alinea prismas de neón antes de que se apague el reloj.                                                                                                                                                                 |
| `long_desc`  | Intercambia prismas vecinos para alinear tres o más del mismo color y descomponer la luz en cascadas. Recompón el espectro completo de seis colores para liberar un destello de luz blanca. Tienes 90 segundos exactos. |

Origen: sugerencia `prisma` del `game-planner` (estado `recomendado`, 27/30) en `.claude/agent-memory/game-planner/suggestions.md`.
Se respetan sus tres pilares: match-3 por intercambio, contrarreloj de 90 s y categoría PUZZLE.

---

## Relación con el tema

Un prisma descompone la luz blanca en seis colores; el juego hace el camino inverso.

- Cada pieza es un **prisma de color** (una faceta del espectro) con forma geométrica propia.
- Romper prismas "refracta" su color hacia el panel **ESPECTRO**, que tiene seis ranuras, una por color.
- Cuando las seis ranuras están encendidas, los colores se recombinan en **LUZ BLANCA**: +500 puntos y el espectro se vacía.
- Las cascadas son la luz rebotando dentro del prisma: cada rebote multiplica los puntos.

El tema decide qué jugada conviene: a veces vale más romper el color que falta en el espectro que la línea más larga.

---

## Mecánicas

### Tablero

- Rejilla de **8 columnas × 8 filas**.
- **6 colores** de prisma, cada uno con forma propia (ver Dirección de arte).
- Coordenadas `(fila, columna)` con origen arriba a la izquierda.

### Bucle de juego

1. El jugador intercambia dos prismas **adyacentes en horizontal o vertical** (nunca en diagonal).
2. Si el intercambio forma al menos una **línea** (3 o más prismas del mismo color seguidos en una fila o columna), es válido.
3. Si no forma ninguna línea, es inválido: los prismas vuelven a su sitio y no hay penalización de puntos.
4. Las líneas se rompen y suman puntos (paso de cascada 1).
5. Los prismas de encima caen para rellenar huecos; entran prismas nuevos aleatorios por arriba.
6. Si la caída forma nuevas líneas, se rompen como paso 2, 3… (cascada).
7. Cuando el tablero queda estable, se comprueba si queda algún movimiento válido.
8. Si no queda ninguno, el tablero se **rebaraja** (ver abajo).
9. El jugador vuelve a tener el control.

### Reglas de detección

- Una línea es una secuencia máxima de 3 o más prismas iguales en una fila o en una columna.
- Una forma en L o en T cuenta como **dos líneas** (una horizontal y una vertical) que comparten un prisma.
- Un prisma compartido por dos líneas se rompe y puntúa **una sola vez**.
- Todas las líneas presentes en el tablero se resuelven a la vez en el mismo paso.
- Intercambiar dos prismas del mismo color es siempre inválido.

### Tablero inicial

- Se genera celda a celda, de izquierda a derecha y de arriba abajo.
- En cada celda se excluyen los colores que formarían línea con las dos celdas de la izquierda o con las dos de arriba.
- Si el tablero resultante no tiene ningún movimiento válido, se genera otro (hasta 100 intentos; en la práctica basta uno).
- Resultado garantizado: cero líneas formadas y al menos un movimiento válido.

### Relleno

- Los prismas nuevos son aleatorios uniformes entre los 6 colores, sin restricción.
- Pueden formar líneas al caer: así nacen las cascadas.

### Sin movimientos: rebarajar

- Tras cada tablero estable se busca un movimiento válido.
- Si no existe, aparece el aviso `SIN MOVIMIENTOS · REBARAJANDO` durante **600 ms**.
- Los 64 prismas existentes se mezclan (mismos colores, nuevas posiciones) hasta que no haya líneas y exista al menos un movimiento.
- Si en 100 intentos no se consigue, se genera un tablero nuevo con las reglas del tablero inicial.
- El rebarajado **no da puntos** y **el reloj se detiene** durante los 600 ms.

### Pista

- Si el jugador pasa **8 s** con el control sin hacer un intercambio válido, dos prismas de un movimiento válido laten suavemente.
- La pista desaparece en cuanto se hace cualquier intercambio.
- No penaliza la puntuación.

### Duraciones de animación

| Animación                         | Duración              |
| --------------------------------- | --------------------- |
| Intercambio                       | 120 ms                |
| Reversión de intercambio inválido | 120 ms (240 ms total) |
| Rotura de una línea (destello)    | 180 ms                |
| Caída                             | 60 ms por celda       |
| Aviso de rebarajado               | 600 ms                |
| Texto flotante de puntos          | 600 ms                |

---

## Controles

El juego acepta ratón, táctil y teclado a la vez.

### Ratón y táctil

| Gesto                                          | Acción                                           |
| ---------------------------------------------- | ------------------------------------------------ |
| Clic / toque en un prisma                      | Lo selecciona (marco blanco)                     |
| Clic / toque en un prisma adyacente al elegido | Intenta el intercambio                           |
| Clic / toque en un prisma no adyacente         | Mueve la selección a ese prisma                  |
| Clic / toque en el prisma ya seleccionado      | Quita la selección                               |
| Arrastrar desde un prisma ≥ 40 % de una celda  | Intenta el intercambio en la dirección dominante |
| Clic / toque en la pantalla de inicio          | Empieza la partida                               |

### Teclado (con el lienzo enfocado)

| Tecla                         | Acción                                                                    |
| ----------------------------- | ------------------------------------------------------------------------- |
| `←` `↑` `→` `↓` / `W A S D`   | Mueve el cursor; con un prisma agarrado, intenta el intercambio hacia ahí |
| `Espacio` / `Enter`           | Agarra el prisma bajo el cursor; si ya está agarrado, lo suelta           |
| `Esc`                         | Suelta el prisma agarrado                                                 |
| `P`                           | Pausa / reanuda                                                           |
| `Espacio` / `Enter` en inicio | Empieza la partida                                                        |

- Mientras se resuelve una cascada, el cursor se puede mover pero no se aceptan intercambios ni clics de selección.
- La pausa oculta el tablero para que no se pueda planificar con el reloj parado.

---

## Puntuación

La puntuación es **un único entero ≥ 0**; mayor es mejor.
No hay bonus de tiempo restante ni penalizaciones.

### Por paso de resolución

```text
puntos_paso = (prismas_rotos × 10 + bonus_líneas) × mult_cascada × mult_crítico
```

| Concepto         | Valor                                                                                  |
| ---------------- | -------------------------------------------------------------------------------------- |
| `prismas_rotos`  | Prismas distintos rotos en el paso (unión de todas las líneas).                        |
| Por prisma       | **10** puntos.                                                                         |
| Línea de 3       | +0 de bonus.                                                                           |
| Línea de 4       | **+40** de bonus por línea.                                                            |
| Línea de 5 o más | **+100** de bonus por línea.                                                           |
| `mult_cascada`   | Paso 1 = ×1, paso 2 = ×2, paso 3 = ×3, paso 4 = ×4, paso 5 o más = **×5** (tope).      |
| `mult_crítico`   | **×2** si el paso se resuelve con 10 s o menos en el reloj (incluido el 0); si no, ×1. |

### Espectro

| Concepto        | Valor                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------ |
| Ranuras         | 6, una por color.                                                                          |
| Encendido       | Una ranura se enciende cuando se rompe al menos un prisma de su color.                     |
| LUZ BLANCA      | Al encenderse la sexta ranura: **+500** fijos, sin multiplicadores.                        |
| Reinicio        | Tras la LUZ BLANCA las seis ranuras se apagan; los colores del mismo paso no se arrastran. |
| Máximo por paso | Una LUZ BLANCA por paso de resolución.                                                     |

### Ejemplos

| Jugada                                           | Cálculo             | Puntos |
| ------------------------------------------------ | ------------------- | ------ |
| Línea de 3, sin cascada                          | (3×10 + 0) × 1      | 30     |
| Línea de 4, sin cascada                          | (4×10 + 40) × 1     | 80     |
| Línea de 5, sin cascada                          | (5×10 + 100) × 1    | 150    |
| L de 3+3 (5 prismas), sin cascada                | (5×10 + 0) × 1      | 50     |
| Línea de 3 en el paso 2 de cascada               | (3×10) × 2          | 60     |
| Línea de 4 en el paso 6 de cascada, fase crítica | (4×10 + 40) × 5 × 2 | 800    |

Rango orientativo: partida casual 2.000–4.000; partida experta 8.000–15.000.

---

## Progresión de dificultad

La partida dura siempre 90 s; la presión es el reloj.

| Momento (reloj) | Cambio                                                                                                           |
| --------------- | ---------------------------------------------------------------------------------------------------------------- |
| 90 s → 11 s     | Reglas base. 6 colores constantes.                                                                               |
| 10 s → 0 s      | **FASE CRÍTICA**: todos los puntos de paso valen ×2; la barra de tiempo y el borde del tablero laten en magenta. |
| 0 s             | Se acaba el control; la cascada en curso se resuelve al instante y cuenta (ver Fin de partida).                  |

- La fase crítica premia arriesgarse al final en lugar de jugar seguro.
- El número de colores no cambia: con 6 colores en 8×8 las cascadas son frecuentes pero no gratuitas.

---

## Fin de partida

La partida termina **solo** por una de estas dos causas:

1. El reloj llega a **0**.
2. El jugador pulsa **FIN** en el HUD del Reproductor.

Al terminar:

- Se bloquea la entrada de inmediato.
- Si había un intercambio **válido** en animación, se completa.
- Si había un intercambio **inválido** en animación, se revierte sin puntos.
- La cascada en curso se resuelve **al instante, sin animación**, y sus puntos **cuentan** con sus multiplicadores (incluido el ×2 crítico).
- Por seguridad, la resolución instantánea se corta tras 50 pasos (en la práctica nunca se alcanza).
- No se rebaraja ni se comprueban movimientos.
- Aparece `¡TIEMPO!` sobre el tablero durante 800 ms y después el modal FIN DEL JUEGO con la puntuación final.

Salir con SALIR abandona la partida sin puntuación.
No existe game over por quedarse sin movimientos: siempre se rebaraja.

---

## Dirección de arte

Identidad de Arcade Vault: neón sobre negro, scanlines CRT del Reproductor, fuente pixel `Press Start 2P` para textos.

### Paleta de prismas

| Índice | Color    | Hex       | Forma     |
| ------ | -------- | --------- | --------- |
| 0      | Cian     | `#00f5ff` | Triángulo |
| 1      | Magenta  | `#ff006e` | Rombo     |
| 2      | Amarillo | `#f5ff00` | Hexágono  |
| 3      | Verde    | `#00ff88` | Cuadrado  |
| 4      | Naranja  | `#ff7700` | Pentágono |
| 5      | Violeta  | `#aa00ff` | Octógono  |

- Cian, magenta, amarillo y verde son los tokens de `app/globals.css`; naranja y violeta ya existen en `.cover-tetro`.
- Cada forma es distinta para que el juego se pueda jugar sin distinguir colores.

### Prismas

- Polígono relleno al 85 % de opacidad con contorno de 2 px del mismo color y resplandor (`shadowBlur` 12).
- Una faceta interior más clara (triángulo blanco al 25 %) arriba a la izquierda sugiere el volumen de cristal.
- Tamaño: 80 % de la celda, centrado.

### Tablero y lienzo

- Lienzo lógico de 640 × 480 (el 4:3 de `.crt-screen`).
- Tablero en `(32, 32)`, celdas de 52 px, 416 × 416 en total.
- Fondo del tablero `#07070f` con rejilla de líneas `rgba(0, 245, 255, 0.08)`.
- Barra de tiempo vertical en `x = 464`, 8 × 416 px, que se vacía de arriba abajo; cian, magenta en fase crítica.
- Panel derecho (`x = 488` a `616`):
  - Rótulo `ESPECTRO` y seis ranuras en columna con la forma de cada color; apagadas al 15 %, encendidas al 100 % con resplandor.
  - Contador `LUZ ×N` con las LUZ BLANCA conseguidas.
  - Indicador `CASCADA ×N` durante las cascadas (desde el paso 2).

### Efectos

- Selección: marco blanco de 2 px que pulsa (opacidad 0,6–1 a 2 Hz).
- Cursor de teclado: esquinas cian en las cuatro esquinas de la celda; con prisma agarrado, esquinas amarillas.
- Rotura: destello blanco de 180 ms y 6 esquirlas por prisma con los seis colores del espectro, 300 ms.
- Texto flotante `+N` en el centro de cada paso, sube 24 px en 600 ms.
- LUZ BLANCA: barrido blanco horizontal sobre el tablero en 400 ms y rótulo `LUZ BLANCA +500`.
- Fase crítica: borde del tablero que late en magenta a 2 Hz.
- Intercambio inválido: sacudida horizontal de ±4 px durante la reversión.

### Pantallas del lienzo

- Inicio: tablero oculto, título `PRISMA` en magenta y `PULSA ESPACIO O TOCA PARA EMPEZAR`.
- Pausa: tablero oculto, `EN PAUSA` (el Reproductor ya pinta su capa de pausa).
- Fin: `¡TIEMPO!` en amarillo durante 800 ms.

### HUD del Reproductor (DOM)

`JUGADOR` · `PUNTUACIÓN` · `TIEMPO` (`1:30` → `0:00`) · `ESPECTROS` (LUZ BLANCA conseguidas).

---

## Sonido

Propuesta para un spec futuro (fuera de los specs `02` y `03`):

- Intercambio: clic corto de onda cuadrada.
- Rotura: nota ascendente; un semitono más alta por cada paso de cascada.
- LUZ BLANCA: arpegio de seis notas.
- Fase crítica: tic por segundo.
- Todo con Web Audio API, sin archivos externos.

---

## Qué no entra

- **Piezas especiales** (prismas que explotan, limpian filas o colores). Acercan el juego a match-3 comerciales concretos y complican la puntuación.
- **Bonus de tiempo**: la partida dura exactamente 90 s siempre.
- **Niveles, objetivos o tableros con huecos**: una sola modalidad, siempre igual, para un leaderboard justo.
- **Semilla diaria compartida**: sería un modo distinto con su propio ranking.
- **Sonido**: ver la sección anterior.
- **Validación antitrampas en servidor** de la puntuación.
