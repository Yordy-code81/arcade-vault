import type { ScoreRow } from "@/lib/data";

const TOP_CLASS = ["top1", "top2", "top3"];

export function Leaderboard({ scores }: { scores: ScoreRow[] }) {
  return (
    <div className="leaderboard">
      <h3>MEJORES PUNTUACIONES</h3>
      <ol>
        {scores.map((r, i) => (
          <li key={r.name} className={`lb-row ${TOP_CLASS[i] ?? ""}`}>
            <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
            <div className="pl">
              {r.name}
              <div className="text-[10px] tracking-[0.1em] text-ink-faint">{r.date}</div>
            </div>
            <div className="sc">{r.score.toLocaleString("es-ES")}</div>
          </li>
        ))}
      </ol>
    </div>
  );
}
