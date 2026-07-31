"use client";

import { useEffect } from "react";

/**
 * The landing page scrolls inside its own snap container, so the browser's hash
 * handling and scroll restoration never reach it. This does two things:
 *
 *  1. On arrival — and whenever a hash link like "/#landscape" is followed — it
 *     brings that screen into view, since the browser will not scroll a nested
 *     container to a hash on its own.
 *  2. As the reader moves between screens it keeps the URL's hash on the screen
 *     in view, quietly via replaceState (no new history entries). So leaving for
 *     a topic or a starter and coming back — through our own Back link or the
 *     browser's — returns to the screen they left rather than the top.
 */
export default function SnapHashScroll() {
  useEffect(() => {
    const container =
      document.querySelector<HTMLElement>("[data-snap-scroll]");
    const sections = container
      ? Array.from(
          container.querySelectorAll<HTMLElement>("[data-snap-section]"),
        )
      : [];

    const scrollToHash = () => {
      const id = window.location.hash.slice(1);
      if (!id) return;
      document.getElementById(id)?.scrollIntoView({ behavior: "instant" });
    };
    scrollToHash();
    window.addEventListener("hashchange", scrollToHash);

    // Mirror the screen in view into the hash. Each screen fills the container,
    // so the nearest whole multiple of its height is the one on show.
    let frame = 0;
    const syncHash = () => {
      frame = 0;
      if (!container || sections.length === 0) return;
      const raw = Math.round(container.scrollTop / container.clientHeight);
      const i = Math.max(0, Math.min(sections.length - 1, raw));
      const id = sections[i]?.id ?? "";
      const next = id ? `#${id}` : "";
      if (next === window.location.hash) return;
      const url = next || window.location.pathname + window.location.search;
      window.history.replaceState(null, "", url);
    };
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(syncHash);
    };
    container?.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("hashchange", scrollToHash);
      container?.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  return null;
}
