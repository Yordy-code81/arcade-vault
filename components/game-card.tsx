"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, type MouseEvent } from "react";
import type { Game, NeonColor } from "@/lib/data";

const BTN_VARIANT: Record<NeonColor, string> = {
  cyan: "",
  green: "",
  magenta: "magenta",
  yellow: "yellow",
};

export function GameCard({ game }: { game: Game }) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const href = `/juegos/${game.id}`;

  // Tilt effect: computed on every mousemove, so it is written straight to
  // style.transform (allowed exception in the spec).
  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `translateY(-6px) rotateX(${-py * 6}deg) rotateY(${px * 8}deg)`;
  };
  const onLeave = () => {
    if (ref.current) ref.current.style.transform = "";
  };

  return (
    <div
      ref={ref}
      className="card"
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onClick={() => router.push(href)}
    >
      <div className="cover">
        <div className={`cover-bg ${game.cover}`} />
        <div className="label">{game.cat}</div>
      </div>
      <div className="meta">
        <div className="title">{game.title}</div>
        <div className="desc">{game.short}</div>
        <div className="row">
          <div className="score-badge">
            <span>MEJOR PUNTUACIÓN</span>
            <b>{game.best.toLocaleString("es-ES")}</b>
          </div>
          <Link
            href={href}
            className={`btn ${BTN_VARIANT[game.color]}`}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Jugar a ${game.title}`}
          >
            JUGAR
          </Link>
        </div>
      </div>
    </div>
  );
}
