// Session store backed by Supabase Auth + public.profiles.
// Client-only: import it only from "use client" components.
//
// Login/logout run as Server Actions (app/login/actions.ts) that write the
// auth cookies on the server; the browser client does not notice on its own,
// so callers must `await syncSession()` after each action.
import { useSyncExternalStore } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

export interface SessionUser {
  id: string; // auth.users.id
  name: string; // profiles.username (UPPERCASE, 3–10, A-Z 0-9 _)
}

let supabase: ReturnType<typeof createClient> | null = null;
let current: SessionUser | null = null;
let started = false;
let loadSeq = 0; // ignores results of stale, overlapping loads
const listeners = new Set<() => void>();

function client() {
  supabase ??= createClient();
  return supabase;
}

function setCurrent(next: SessionUser | null) {
  // Keep the same reference when nothing changed so subscribers don't re-render.
  if (current?.id === next?.id && current?.name === next?.name) return;
  current = next;
  listeners.forEach((listener) => listener());
}

async function load(user: User | null): Promise<void> {
  const seq = ++loadSeq;
  let next: SessionUser | null = null;
  if (user) {
    const { data } = await client()
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .maybeSingle();
    if (data) next = { id: user.id, name: data.username };
  }
  if (seq === loadSeq) setCurrent(next);
}

function start() {
  if (started) return;
  started = true;
  // Fires INITIAL_SESSION on subscribe, then on changes from other tabs or token expiry.
  client().auth.onAuthStateChange((_event, session) => {
    // Defer: calling other Supabase methods inside this callback can deadlock.
    setTimeout(() => void load(session?.user ?? null), 0);
  });
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  start();
  return () => listeners.delete(onChange);
}

function getSnapshot(): SessionUser | null {
  return current;
}

function getServerSnapshot(): SessionUser | null {
  return null;
}

export function useSession(): SessionUser | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Re-reads the user and profile from Supabase and notifies subscribers. */
export async function syncSession(): Promise<void> {
  try {
    const {
      data: { user },
    } = await client().auth.getUser();
    await load(user);
  } catch {
    await load(null);
  }
}
