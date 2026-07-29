"use client";

import { useEffect } from "react";

/**
 * The landing page scrolls inside its own snap container, which Next.js's
 * built-in hash handling does not reach when navigating here from another
 * page. This scrolls the hash target into view on mount and on hash changes.
 */
export default function SnapHashScroll() {
  useEffect(() => {
    const scroll = () => {
      const id = window.location.hash.slice(1);
      if (!id) return;
      document.getElementById(id)?.scrollIntoView({ behavior: "instant" });
    };
    scroll();
    window.addEventListener("hashchange", scroll);
    return () => window.removeEventListener("hashchange", scroll);
  }, []);
  return null;
}
