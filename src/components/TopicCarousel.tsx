"use client";

import { useEffect } from "react";
import Link from "next/link";
import TopicTensions from "@/components/TopicTensions";
import {
  useCarousel,
  CarouselTrack,
  CarouselDots,
  CarouselArrow,
  Chevron,
} from "@/components/Carousel";
import type { Landscape } from "@/lib/types";

/**
 * The landscape itself: one topic per slide, each showing that topic's
 * tensions. Swipe, arrow, or tap between topics; the URL follows so any topic
 * stays shareable. A view arrived at through `?pov=` opens on its own topic
 * with that voice marked, which is where someone lands right after publishing.
 */
export default function TopicCarousel({
  landscape,
  initialIndex,
  focusPovId,
}: {
  landscape: Landscape;
  initialIndex: number;
  focusPovId: string | null;
}) {
  const topics = landscape.topics;
  const count = topics.length;
  const { index, go, next, prev, trackRef, touchHandlers } = useCarousel({
    count,
    initial: initialIndex,
  });

  // Keep the address bar on the current topic so the page can be shared or
  // reloaded onto the same slide, without re-running the server component.
  useEffect(() => {
    if (count === 0) return;
    const url = new URL(window.location.href);
    url.searchParams.set("topic", String(index));
    url.searchParams.delete("pov");
    window.history.replaceState(null, "", url);
  }, [index, count]);

  if (count === 0) {
    return (
      <main className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center border-b border-line px-5 py-4 sm:px-8">
          <Link
            href="/#landscape"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft transition-colors hover:text-ink"
          >
            <Chevron dir="left" />
            Back
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center px-5">
          <p className="max-w-sm text-center font-display text-xl leading-snug text-ink-soft">
            The landscape is still forming. Add the first views and topics will
            emerge.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-0 flex-1">
      <div className="flex h-full flex-col">
        {/* Top bar spans the full width: the way back at the left edge, which
            topic in the middle, and the way in at the right edge. */}
        <div className="grid grid-cols-3 items-center border-b border-line px-5 py-4 sm:px-8">
          <Link
            href="/#landscape"
            className="inline-flex items-center gap-1.5 justify-self-start text-sm font-medium text-ink-soft transition-colors hover:text-ink"
          >
            <Chevron dir="left" />
            Back
          </Link>
          <p className="justify-self-center text-xs font-medium uppercase tracking-[0.14em] text-muted">
            Topic {index + 1} of {count}
          </p>
          <Link
            href="/#starters"
            className="justify-self-end whitespace-nowrap rounded-full bg-ink px-3.5 py-2 text-xs font-medium text-paper hover:bg-ink/85 sm:px-5 sm:py-2.5 sm:text-sm"
          >
            Add your view
          </Link>
        </div>

        <CarouselTrack
          index={index}
          trackRef={trackRef}
          touchHandlers={touchHandlers}
        >
          {topics.map((topic) => (
            <TopicTensions
              key={topic.id}
              topic={topic}
              focusPovId={focusPovId}
            />
          ))}
        </CarouselTrack>

        {/* Bottom bar, also full width: arrows at the edges, dots centered. */}
        <div className="flex items-center justify-between border-t border-line px-5 py-4 sm:px-8">
          <CarouselArrow
            dir="left"
            onClick={prev}
            disabled={index === 0}
            label="Previous topic"
          />
          <CarouselDots
            count={count}
            index={index}
            onGo={go}
            labelFor={(i) => `Show topic ${i + 1}`}
          />
          <CarouselArrow
            dir="right"
            onClick={next}
            disabled={index === count - 1}
            label="Next topic"
          />
        </div>
      </div>
    </main>
  );
}
