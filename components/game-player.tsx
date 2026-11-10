"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Game } from "@/lib/data";
import { saveScore } from "@/lib/scores";
import { useSession } from "@/lib/session";

interface Run {
  score: number;
  lives: number;
  level: number;
}

const FRESH_RUN: Run = { score: 0, lives: 3, level: 1 };

// Simulated tick, same rules as the template: +10..99 points every 220 ms,
// and level up whenever the score lands in the first 100 points of a 2500 block.
function tick(run: Run): Run {
  const score = run.score + Math.floor(10 + Math.random() * 90);
  const level = score % 2500 < 100 ? run.level + 1 : run.level;
  return { ...run, score, level };
}

export function GamePlayer({ game }: { game: Game }) {
  const user = useSession();
  const [run, setRun] = useState<Run>(FRESH_RUN);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [saved, setSaved] = useState(false);
  // null = not edited yet, so it follows the session (which hydrates after the first render).
  const [nameInput, setNameInput] = useState<string | null>(null);
  const name = nameInput ?? user?.name ?? "INVITADO";

  useEffect(() => {
    if (over || paused) return;
    const t = setInterval(() => setRun(tick), 220);
    return () => clearInterval(t);
  }, [over, paused]);

  const restart = () => {
    setRun(FRESH_RUN);
    setPaused(false);
    setOver(false);
    setSaved(false);
  };

  const save = () => {
    saveScore({ game: game.id, score: run.score, name });
    setSaved(true);
  };

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div className="flex flex-wrap gap-6">
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v text-ink">{name}</div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{run.score.toLocaleString("es-ES")}</div>
          </div>
          <div className="hud-stat lives">
            <div className="l">Vidas</div>
            <div className="v" aria-label={`${run.lives} vidas`}>
              {"♥ ".repeat(run.lives).trim() || "—"}
            </div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(run.level).padStart(2, "0")}</div>
          </div>
        </div>
        <div className="hud-actions">
          <button type="button" className="btn yellow" onClick={() => setPaused((p) => !p)}>
            {paused ? "REANUDAR" : "PAUSA"}
          </button>
          <button type="button" className="btn magenta" onClick={() => setOver(true)}>
            FIN
          </button>
          <Link href={`/juegos/${game.id}`} className="btn ghost">
            SALIR
          </Link>
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen">
          <div className="game-arena" aria-hidden="true">
            <div className="grid-floor" />
            <div className="enemy e1" />
            <div className="enemy e2" />
            <div className="enemy e3" />
            <div className="player-ship" />
          </div>
          {paused && (
            <div className="crt-content z-[5] bg-black/60" role="status">
              <div>
                <div className="pixel neon-yellow text-[22px]">EN PAUSA</div>
                <div className="mono mt-2.5 text-[11px] tracking-[0.16em] text-ink-dim">
                  PULSA REANUDAR PARA CONTINUAR
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>{game.title} · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      {over && (
        <div className="modal-bd">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="game-over-title">
            <h2 id="game-over-title">FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{run.score.toLocaleString("es-ES")}</div>
            {!saved ? (
              <div className="input-row">
                <input
                  value={name}
                  onChange={(e) => setNameInput(e.target.value.toUpperCase().slice(0, 10))}
                  placeholder="TUS INICIALES"
                  aria-label="Nombre para la puntuación"
                  autoFocus
                />
                <button type="button" className="btn yellow" onClick={save}>
                  GUARDAR PUNTUACIÓN
                </button>
              </div>
            ) : (
              <div className="toast-saved" role="status">
                ▸ PUNTUACIÓN GUARDADA_
              </div>
            )}
            <div className="actions">
              <button type="button" className="btn" onClick={restart}>
                JUGAR DE NUEVO
              </button>
              <Link href="/" className="btn magenta">
                VOLVER AL VAULT
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
