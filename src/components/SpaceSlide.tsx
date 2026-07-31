"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import LoadingDots from "@/components/LoadingDots";
import { useMyPovIds } from "@/lib/mine";
import type { Landscape } from "@/lib/types";

// three.js is heavy, so the 3D scene is only pulled in on the client, and only
// once the visitor actually reaches this slide (see `mounted` below). This
// keeps the landing page's initial load as light as it was before the slide.
const SpaceView = dynamic(() => import("./SpaceView"), {
  ssr: false,
  loading: () => <Placeholder />,
});

function Placeholder() {
  return (
    <div className="flex h-full items-center justify-center rounded-[16px] border border-line bg-[#eef1f7] text-ink/45">
      <LoadingDots />
    </div>
  );
}

/**
 * The 3D landscape as a carousel slide. It mounts the scene the first time it
 * is reached and then stays mounted, so switching back to it is instant. Touch
 * gestures are kept to the canvas so a one finger drag orbits the space rather
 * than swiping the carousel; the arrows and dots switch slides instead.
 */
export default function SpaceSlide({
  landscape,
  active,
}: {
  landscape: Landscape;
  active: boolean;
}) {
  const myIds = useMyPovIds();
  // Latch on first activation and stay mounted thereafter, so returning to the
  // slide is instant and the heavy scene only loads once, on demand. This is
  // the "adjust state during render" pattern: the guard makes it converge.
  const [everActive, setEverActive] = useState(active);
  if (active && !everActive) setEverActive(true);
  const mounted = active || everActive;

  return (
    <div
      className="h-full"
      onTouchStart={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
    >
      {mounted ? (
        <SpaceView landscape={landscape} myIds={myIds} focusPovId={null} fill />
      ) : (
        <Placeholder />
      )}
    </div>
  );
}
