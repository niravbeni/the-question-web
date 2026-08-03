"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import TopicTensions from "@/components/TopicTensions";
import LoadingDots from "@/components/LoadingDots";
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
 *
 * The page is a cached, static render shared by everyone, so the opening slide
 * is resolved here on the client from the URL rather than on the server: an
 * explicit `?topic=i`, else the topic holding a `?pov=` voice, else the first.
 * On a client navigation these params are known immediately, so tapping a
 * topic on the home page lands on the right slide with no server round-trip.
 *
 * Someone landing here straight after publishing can outrun the cache: the
 * page may have been rendered moments before their view was added, so their
 * `?pov=` is nowhere in the data and their dot would be missing. When that
 * happens, hold on a brief loading beat and fetch the live landscape from the
 * API, so the first thing they see is the topic with their own voice on it.
 */
export default function TopicCarousel({ landscape }: { landscape: Landscape }) {
  const searchParams = useSearchParams();
  const [pov] = useState(() => searchParams.get("pov"));
  const stale =
    pov !== null && !landscape.spiderPoints.some((p) => p.povId === pov);

  const [fresh, setFresh] = useState<Landscape | null>(null);
  useEffect(() => {
    if (!stale) return;
    let cancelled = false;
    fetch("/api/landscape")
      .then((res) => res.json())
      .then((data: { landscape?: Landscape }) => {
        if (!cancelled) setFresh(data.landscape ?? landscape);
      })
      .catch(() => {
        // The cached render is still a working page; show it rather than hang.
        if (!cancelled) setFresh(landscape);
      });
    return () => {
      cancelled = true;
    };
    // Runs once: `stale` and `landscape` are fixed for the life of the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (stale && !fresh) {
    return (
      <main className="flex min-h-0 flex-1 items-center justify-center text-ink-soft">
        <LoadingDots />
      </main>
    );
  }

  return <TopicCarouselInner landscape={fresh ?? landscape} />;
}

function TopicCarouselInner({ landscape }: { landscape: Landscape }) {
  const topics = landscape.topics;
  const count = topics.length;

  // Read the opening state from the URL once, at mount. The effect below strips
  // ?pov= from the address bar shortly after, and useSearchParams is reactive,
  // so freezing here keeps the just-published voice highlighted.
  const searchParams = useSearchParams();
  const [{ initialIndex, focusPovId }] = useState(() => {
    const topicParam = searchParams.get("topic");
    const pov = searchParams.get("pov");
    const lastTopic = count - 1;
    const parsed = topicParam !== null ? Number.parseInt(topicParam, 10) : NaN;
    let index = Number.isNaN(parsed)
      ? -1
      : Math.max(0, Math.min(lastTopic, parsed));
    if (index < 0 && pov) {
      const point = landscape.spiderPoints.find((p) => p.povId === pov);
      if (point) index = topics.findIndex((t) => t.id === point.topicId);
    }
    if (index < 0) index = 0;
    return { initialIndex: index, focusPovId: pov };
  });

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
