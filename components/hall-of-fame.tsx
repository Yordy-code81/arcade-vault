"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { seededScores, type Game, type ScoreRow } from "@/lib/data";
import { useSession } from "@/lib/session";

const TOP_CLASS = ["top1", "top2", "top3"];

// Staggered "rise" entrance, 50 ms per row. Literal class names so Tailwind
// can generate them (12 rows + the "TU MEJOR MARCA" row at index 13).
const ROW_DELAY = [
  "[animation-delay:0ms]",
  "[animation-delay:50ms]",
  "[animation-delay:100ms]",
  "[animation-delay:150ms]",
  "[animation-delay:200ms]",
  "[animation-delay:250ms]",
  "[animation-delay:300ms]",
  "[animation-delay:350ms]",
  "[animation-delay:400ms]",
  "[animation-delay:450ms]",
  "[animation-delay:500ms]",
  "[animation-delay:550ms]",
  "[animation-delay:600ms]",
  "[animation-delay:650ms]",
];

const fmt = (n: number) => n.toLocaleString("es-ES");

function PodiumSlot({
  row,
  tier,
}: {
  row: ScoreRow;
  tier: "silver" | "bronze";
}) {
  return (
    <div className={`podium-slot ${tier}`}>
      <div className="rank-num">{String(row.rank).padStart(2, "0")}</div>
      <div className="name">{row.name}</div>
      <div className="score">{fmt(row.score)}</div>
      <div className="date">{row.date}</div>
    </div>
  );
}

export function HallOfFame({ games }: { games: Game[] }) {
  const user = useSession();
  const [tab, setTab] = useState(games[0].id);
  const rows = useMemo(() => seededScores(tab.length * 23 + 7, 12), [tab]);
  const game = games.find((g) => g.id === tab) ?? games[0];

  // Mock "your best" row, same formula as the template.
  const youRank = 8 + (tab.length % 4);
  const youScore = (rows[5]?.score ?? 0) - 2400 || 9999;

  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel text-[10px]">
          LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA
        </p>
      </div>

      <div className="hall-tabs" role="group" aria-label="Elegir juego">
        {games.map((g) => (
          <button
            key={g.id}
            type="button"
            className={"chip" + (tab === g.id ? " active" : "")}
            aria-pressed={tab === g.id}
            onClick={() => setTab(g.id)}
          >
            {g.title}
          </button>
        ))}
      </div>

      <div className="podium">
        <PodiumSlot row={rows[1]} tier="silver" />
        <div className="podium-slot gold">
          <div className="pixel text-[9px] tracking-[0.18em] text-gold">
            CAMPEÓN
          </div>
          <div className="rank-num mt-1 text-[36px]">01</div>
          <div className="name">{rows[0].name}</div>
          <div className="score text-xl">{fmt(rows[0].score)}</div>
          <div className="date">{rows[0].date}</div>
        </div>
        <PodiumSlot row={rows[2]} tier="bronze" />
      </div>

      <div
        className="hall-table"
        role="table"
        aria-label={`Clasificación de ${game.title}`}
      >
        <div className="th" role="row">
          <div role="columnheader">RANGO</div>
          <div role="columnheader">JUGADOR</div>
          <div role="columnheader">PUNTUACIÓN</div>
          <div role="columnheader">FECHA</div>
        </div>
        {rows.map((r, i) => (
          <div
            key={r.name + i}
            role="row"
            className={`tr ${TOP_CLASS[i] ?? ""} ${ROW_DELAY[i]}`}
          >
            <div role="cell" className="rk">
              #{String(r.rank).padStart(2, "0")}
            </div>
            <div role="cell" className="pl">
              {r.name}
            </div>
            <div role="cell" className="sc">
              {fmt(r.score)}
            </div>
            <div role="cell" className="dt">
              {r.date}
            </div>
          </div>
        ))}
        {user && (
          <>
            <div className="tr you-label">▸ TU MEJOR MARCA EN {game.title}</div>
            <div role="row" className={`tr you ${ROW_DELAY[13]}`}>
              <div role="cell" className="rk text-yellow">
                #{String(youRank).padStart(2, "0")}
              </div>
              <div role="cell" className="pl text-yellow">
                {user.name}
              </div>
              <div
                role="cell"
                className="sc text-yellow text-shadow-[0_0_6px_rgba(245,255,0,0.5)]"
              >
                {fmt(youScore)}
              </div>
              <div role="cell" className="dt">
                11/05/2026
              </div>
            </div>
          </>
        )}
      </div>

      <div className="mt-8 text-center">
        <Link href="/" className="btn lg">
          VOLVER A LA BIBLIOTECA
        </Link>
      </div>
    </div>
  );
}
