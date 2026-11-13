// Game catalog read from public.games (SPEC 03).
// Server-only and cached: pages read it and pass it to client components as props.
import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { Category, Game, NeonColor } from "@/lib/data";
import { createPublicClient } from "@/lib/supabase/public";
import type { Tables } from "@/lib/supabase/database.types";

const COLUMNS =
  "id, title, short_desc, long_desc, category, cover, color, best, plays";

type GameRow = Pick<
  Tables<"games">,
  | "id"
  | "title"
  | "short_desc"
  | "long_desc"
  | "category"
  | "cover"
  | "color"
  | "best"
  | "plays"
>;

function toGame(row: GameRow): Game {
  return {
    id: row.id,
    title: row.title,
    short: row.short_desc,
    long: row.long_desc,
    // The table's check constraints keep these within the unions.
    cat: row.category as Category,
    cover: row.cover,
    color: row.color as NeonColor,
    best: row.best,
    plays: row.plays,
  };
}

export async function getGames(): Promise<Game[]> {
  "use cache";
  cacheLife("days");
  cacheTag("games");

  const { data, error } = await createPublicClient()
    .from("games")
    .select(COLUMNS)
    .order("sort_order");
  if (error) throw new Error(`Failed to load games: ${error.message}`);
  return data.map(toGame);
}

export async function getGame(id: string): Promise<Game | undefined> {
  "use cache";
  cacheLife("days");
  cacheTag("games");

  const { data, error } = await createPublicClient()
    .from("games")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Failed to load game "${id}": ${error.message}`);
  return data ? toGame(data) : undefined;
}
