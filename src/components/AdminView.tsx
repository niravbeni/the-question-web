"use client";

import { useCallback, useEffect, useState } from "react";

interface AdminPov {
  id: string;
  starterId: string;
  rawInput: string;
  summary: string;
  topicId: string | null;
  topicLabel: string | null;
  fit: number | null;
  createdAt: string;
  isSeed: boolean;
}

interface AdminStarter {
  id: string;
  text: string;
  shortLabel: string;
  placeholder: string;
  sortOrder: number;
}

type StarterEdit = { text: string; shortLabel: string; placeholder: string };

/**
 * Prototype admin: edit the finish-the-sentence starters, inspect every
 * stored view, edit its text, delete it, clear test data, or reset the
 * whole database to the seed landscape.
 */
export default function AdminView() {
  const [povs, setPovs] = useState<AdminPov[]>([]);
  const [starters, setStarters] = useState<AdminStarter[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, { summary: string; rawInput: string }>>({});
  const [starterEdits, setStarterEdits] = useState<Record<string, StarterEdit>>({});

  // Admin password, kept for the session. The server checks it per request.
  const [adminKey, setAdminKey] = useState<string>(() =>
    typeof window === "undefined" ? "" : (sessionStorage.getItem("admin-key") ?? ""),
  );
  const [locked, setLocked] = useState(false);
  const [keyInput, setKeyInput] = useState("");

  const authFetch = useCallback(
    (input: string, init?: RequestInit) =>
      fetch(input, {
        ...init,
        headers: {
          ...(init?.headers ?? {}),
          "x-admin-key": adminKey,
        },
      }),
    [adminKey],
  );

  const load = useCallback(async () => {
    try {
      const [povRes, starterRes] = await Promise.all([
        authFetch("/api/admin/povs"),
        authFetch("/api/admin/starters"),
      ]);
      if (povRes.status === 401 || starterRes.status === 401) {
        setLocked(true);
        return;
      }
      const povData = (await povRes.json()) as { povs: AdminPov[] };
      const starterData = (await starterRes.json()) as { starters: AdminStarter[] };
      setPovs(povData.povs);
      setStarters(starterData.starters);
      setEdits({});
      setStarterEdits({});
      setLocked(false);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  function unlock() {
    sessionStorage.setItem("admin-key", keyInput);
    setAdminKey(keyInput);
    // load() re-runs via its adminKey dependency
  }

  async function act(fn: () => Promise<Response>, done: string) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fn();
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setMessage(data.error ?? "Action failed.");
      } else {
        setMessage(done);
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  const save = (id: string) => {
    const e = edits[id];
    if (!e) return;
    void act(
      () =>
        authFetch("/api/admin/povs", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, summary: e.summary, rawInput: e.rawInput }),
        }),
      "Saved. The view re-embeds and re-places at the next recalibration.",
    );
  };

  const saveStarter = (id: string) => {
    const e = starterEdits[id];
    if (!e) return;
    void act(
      () =>
        authFetch("/api/admin/starters", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, ...e }),
        }),
      "Starter saved. It shows on the landing page right away.",
    );
  };

  const resetStartersToDefaults = () => {
    if (!confirm("Restore all sentence starters to their defaults?")) return;
    void act(
      () => authFetch("/api/admin/starters", { method: "DELETE" }),
      "Starters restored to defaults.",
    );
  };

  const remove = (id: string) =>
    void act(
      () =>
        authFetch("/api/admin/povs", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        }),
      "Deleted.",
    );

  const clearTestData = () => {
    if (!confirm("Delete every non-seed view? This cannot be undone.")) return;
    void act(
      () =>
        authFetch("/api/admin/povs", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "test-data" }),
        }),
      "Test data cleared.",
    );
  };

  const resetAll = () => {
    if (!confirm("Wipe EVERYTHING (topics, tensions, all views) and restore the seed landscape?"))
      return;
    void act(
      () =>
        authFetch("/api/admin/povs", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "reset-all" }),
        }),
      "Reset to the seed landscape.",
    );
  };

  const recalibrate = () =>
    void act(
      () => authFetch("/api/recalibrate", { method: "POST" }),
      "Recalibrated.",
    );

  const testCount = povs.filter((p) => !p.isSeed).length;

  if (locked) {
    return (
      <main className="flex-1">
        <div className="mx-auto max-w-sm px-5 py-24 text-center">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
            Prototype admin
          </p>
          <h1 className="mt-3 font-display text-2xl text-ink">Enter the admin password</h1>
          <form
            className="mt-6 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              unlock();
            }}
          >
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="Password"
              autoFocus
              className="w-full rounded-full border border-line bg-paper px-4 py-2 text-sm text-ink focus:border-ink/40"
            />
            <button
              type="submit"
              className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-paper hover:bg-ink/85"
            >
              Unlock
            </button>
          </form>
          {adminKey && (
            <p className="mt-3 text-xs text-muted">That password was not right.</p>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-5xl px-5 py-12">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
          Prototype admin · not linked from the site
        </p>

        {/* Sentence starters */}
        <h1 className="mt-3 font-display text-3xl text-ink">Sentence starters</h1>
        <p className="mt-2 text-sm text-ink-soft">
          These are the finish-the-sentence prompts on the landing page. Edits go
          live immediately; reset restores the built-in defaults.
        </p>
        {!loading && (
          <>
            <ul className="mt-6 space-y-4">
              {starters.map((st) => {
                const edit = starterEdits[st.id] ?? {
                  text: st.text,
                  shortLabel: st.shortLabel,
                  placeholder: st.placeholder,
                };
                const dirty =
                  edit.text !== st.text ||
                  edit.shortLabel !== st.shortLabel ||
                  edit.placeholder !== st.placeholder;
                return (
                  <li key={st.id} className="rounded-[12px] border border-line p-4">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] uppercase tracking-wide text-muted">
                      <span>{st.id}</span>
                    </div>

                    <label className="mt-3 block text-[11px] font-medium uppercase tracking-wide text-muted">
                      Sentence
                    </label>
                    <textarea
                      value={edit.text}
                      onChange={(e) =>
                        setStarterEdits((prev) => ({
                          ...prev,
                          [st.id]: { ...edit, text: e.target.value },
                        }))
                      }
                      rows={2}
                      className="mt-1 w-full resize-none rounded-[8px] border border-line bg-paper p-3 text-sm leading-relaxed text-ink focus:border-ink/40"
                    />

                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <div>
                        <label className="block text-[11px] font-medium uppercase tracking-wide text-muted">
                          Short label
                        </label>
                        <input
                          value={edit.shortLabel}
                          onChange={(e) =>
                            setStarterEdits((prev) => ({
                              ...prev,
                              [st.id]: { ...edit, shortLabel: e.target.value },
                            }))
                          }
                          className="mt-1 w-full rounded-[8px] border border-line bg-paper p-3 text-sm text-ink focus:border-ink/40"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium uppercase tracking-wide text-muted">
                          Placeholder (shown in the empty text box)
                        </label>
                        <input
                          value={edit.placeholder}
                          onChange={(e) =>
                            setStarterEdits((prev) => ({
                              ...prev,
                              [st.id]: { ...edit, placeholder: e.target.value },
                            }))
                          }
                          className="mt-1 w-full rounded-[8px] border border-line bg-paper p-3 text-sm text-ink focus:border-ink/40"
                        />
                      </div>
                    </div>

                    <div className="mt-3">
                      <button
                        onClick={() => saveStarter(st.id)}
                        disabled={busy || !dirty}
                        className="rounded-full bg-ink px-4 py-1.5 text-xs font-medium text-paper hover:bg-ink/85 disabled:opacity-30"
                      >
                        Save
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="mt-4">
              <button
                onClick={resetStartersToDefaults}
                disabled={busy}
                className="rounded-full border border-line px-4 py-2 text-xs font-medium text-ink-soft transition-colors hover:border-ink/40 hover:text-ink disabled:opacity-40"
              >
                Reset starters to defaults
              </button>
            </div>
          </>
        )}

        {/* Stored views */}
        <h1 className="mt-14 border-t border-line pt-10 font-display text-3xl text-ink">
          Stored views
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          {povs.length} total · {testCount} from testing · {povs.length - testCount} seed
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            onClick={clearTestData}
            disabled={busy || testCount === 0}
            className="rounded-full border border-line px-4 py-2 text-xs font-medium text-ink-soft transition-colors hover:border-ink/40 hover:text-ink disabled:opacity-40"
          >
            Clear test data ({testCount})
          </button>
          <button
            onClick={resetAll}
            disabled={busy}
            className="rounded-full border border-line px-4 py-2 text-xs font-medium text-ink-soft transition-colors hover:border-ink/40 hover:text-ink disabled:opacity-40"
          >
            Reset everything to seeds
          </button>
          <button
            onClick={recalibrate}
            disabled={busy}
            className="rounded-full border border-line px-4 py-2 text-xs font-medium text-ink-soft transition-colors hover:border-ink/40 hover:text-ink disabled:opacity-40"
          >
            Recalibrate now
          </button>
          {message && <p className="text-xs text-muted">{message}</p>}
        </div>

        {loading ? (
          <p className="mt-12 text-sm text-muted">Loading…</p>
        ) : (
          <ul className="mt-8 space-y-4">
            {povs.map((pov) => {
              const edit = edits[pov.id] ?? {
                summary: pov.summary,
                rawInput: pov.rawInput,
              };
              const dirty =
                edit.summary !== pov.summary || edit.rawInput !== pov.rawInput;
              return (
                <li key={pov.id} className="rounded-[12px] border border-line p-4">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] uppercase tracking-wide text-muted">
                    <span>{new Date(pov.createdAt).toLocaleString()}</span>
                    <span>starter: {pov.starterId}</span>
                    <span>{pov.topicLabel ?? "unplaced"}</span>
                    {pov.fit !== null && <span>fit {pov.fit.toFixed(2)}</span>}
                    {pov.isSeed && (
                      <span className="rounded-full border border-line px-2 py-0.5">
                        seed
                      </span>
                    )}
                  </div>

                  <label className="mt-3 block text-[11px] font-medium uppercase tracking-wide text-muted">
                    Public summary
                  </label>
                  <textarea
                    value={edit.summary}
                    onChange={(e) =>
                      setEdits((prev) => ({
                        ...prev,
                        [pov.id]: { ...edit, summary: e.target.value },
                      }))
                    }
                    rows={2}
                    className="mt-1 w-full resize-none rounded-[8px] border border-line bg-paper p-3 text-sm leading-relaxed text-ink focus:border-ink/40"
                  />

                  <details className="mt-2">
                    <summary className="cursor-pointer text-[11px] font-medium uppercase tracking-wide text-muted">
                      Raw input
                    </summary>
                    <textarea
                      value={edit.rawInput}
                      onChange={(e) =>
                        setEdits((prev) => ({
                          ...prev,
                          [pov.id]: { ...edit, rawInput: e.target.value },
                        }))
                      }
                      rows={3}
                      className="mt-1 w-full resize-none rounded-[8px] border border-line bg-paper p-3 text-sm leading-relaxed text-ink focus:border-ink/40"
                    />
                  </details>

                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={() => save(pov.id)}
                      disabled={busy || !dirty}
                      className="rounded-full bg-ink px-4 py-1.5 text-xs font-medium text-paper hover:bg-ink/85 disabled:opacity-30"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => remove(pov.id)}
                      disabled={busy}
                      className="rounded-full border border-line px-4 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-ink/40 hover:text-ink disabled:opacity-40"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
