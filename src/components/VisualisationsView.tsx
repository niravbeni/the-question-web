"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { getMyPovIds } from "@/lib/mine";
import type { Landscape } from "@/lib/types";

// The 3D space view pulls in three.js: load it only on this page.
const SpaceView = dynamic(() => import("./SpaceView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[520px] items-center justify-center rounded-[16px] border border-line bg-[#eef1f7] sm:h-[560px]">
      <p className="text-xs uppercase tracking-wider text-[#5a6275]/60">
        Loading the space…
      </p>
    </div>
  ),
});

/** Standalone 3D visualisation of the whole landscape, off the main flow. */
export default function VisualisationsView({ landscape }: { landscape: Landscape }) {
  const [myIds, setMyIds] = useState<string[]>([]);

  useEffect(() => {
    setMyIds(getMyPovIds());
  }, []);

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-5xl px-5 py-14 sm:py-18">
        <h1 className="max-w-3xl font-display text-3xl leading-tight text-ink sm:text-5xl">
          The landscape in 3D.
        </h1>
        <div className="mt-10">
          <SpaceView landscape={landscape} myIds={myIds} focusPovId={null} />
        </div>
      </div>
    </main>
  );
}
