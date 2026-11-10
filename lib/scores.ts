// Mock score persistence in localStorage["av_scores"].
// Client-only: import it only from "use client" components.
// Write-only in this spec — no screen reads these entries yet.

export interface SavedScore {
  game: string;
  score: number;
  name: string;
  at: number;
}

const KEY = "av_scores";

export function saveScore(entry: Omit<SavedScore, "at">): void {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) || "[]");
    const all: SavedScore[] = Array.isArray(parsed) ? parsed : [];
    all.push({ ...entry, at: Date.now() });
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // localStorage unavailable or corrupted: do nothing.
  }
}
