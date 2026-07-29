"use client";

import { useSyncExternalStore } from "react";

/**
 * Anonymous local identity: the ids of views published from this browser,
 * kept in localStorage so the landscape can mark "you" without any account.
 */
const KEY = "ct-my-pov-ids";

/** Shared empty result, so a browser with nothing stored keeps a stable snapshot. */
const NONE: string[] = [];

function parse(raw: string | null): string[] {
  if (!raw) return NONE;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return NONE;
    const ids = parsed.filter((x): x is string => typeof x === "string");
    return ids.length > 0 ? ids : NONE;
  } catch {
    return NONE;
  }
}

export function getMyPovIds(): string[] {
  if (typeof window === "undefined") return NONE;
  return parse(window.localStorage.getItem(KEY));
}

/*
 * The ids are external state, so components subscribe to them rather than
 * copying them into their own state on mount. Snapshots are cached because
 * useSyncExternalStore compares them by identity.
 */
let cachedRaw: string | null = null;
let cached: string[] = NONE;
const listeners = new Set<() => void>();

function snapshot(): string[] {
  const raw = window.localStorage.getItem(KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cached = parse(raw);
  }
  return cached;
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  // Other tabs of the same site write to the same key.
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The ids published from this browser. Empty until hydration, by necessity. */
export function useMyPovIds(): string[] {
  return useSyncExternalStore(subscribe, snapshot, () => NONE);
}

export function addMyPovId(id: string): void {
  if (typeof window === "undefined") return;
  const ids = getMyPovIds();
  if (ids.includes(id)) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify([...ids, id]));
  } catch {
    // Storage may be unavailable (private mode); the view still publishes.
  }
  for (const listener of listeners) listener();
}
