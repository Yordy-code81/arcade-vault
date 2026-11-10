// Mock session stored in localStorage["av_user"].
// Client-only: import it only from "use client" components.
import { useSyncExternalStore } from "react";

export interface SessionUser {
  name: string; // UPPERCASE, max. 10 characters
}

const KEY = "av_user";
const EVENT = "av:session";

// Cache keyed by the raw string so getSnapshot returns a stable reference.
let cachedRaw: string | null = null;
let cachedUser: SessionUser | null = null;

function readRaw(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function getSnapshot(): SessionUser | null {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      cachedUser =
        parsed && typeof (parsed as SessionUser).name === "string"
          ? { name: (parsed as SessionUser).name }
          : null;
    } catch {
      cachedUser = null;
    }
  }
  return cachedUser;
}

function getServerSnapshot(): SessionUser | null {
  return null;
}

function subscribe(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === KEY) onChange();
  };
  window.addEventListener("storage", onStorage); // other tabs
  window.addEventListener(EVENT, onChange); // this tab
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(EVENT, onChange);
  };
}

function notify() {
  window.dispatchEvent(new Event(EVENT));
}

export function useSession(): SessionUser | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function signIn(user: SessionUser): void {
  const name = user.name.toUpperCase().slice(0, 10);
  try {
    localStorage.setItem(KEY, JSON.stringify({ name }));
  } catch {
    // localStorage unavailable: session stays null.
  }
  notify();
}

export function signOut(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
  notify();
}
