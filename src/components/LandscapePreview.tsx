"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import SpiderView from "@/components/SpiderView";
import SpaceSlide from "@/components/SpaceSlide";
import {
  useCarousel,
  CarouselTrack,
  CarouselDots,
  CarouselArrow,
} from "@/components/Carousel";
import { siteCopy } from "@/content/copy";
import type { Landscape } from "@/lib/types";

/**
 * The landing page's third screen: two ways to read the same landscape, side
 * by side in a small carousel. The grid of topic tiles is the plain contents
 * page; the spider chart is the shape of the whole field. Both lead into a
 * topic's tensions. This screen shares the window with the hero and the
 * sentence starters, so it only claims the arrow keys while it is on view.
 */
const SLIDES = ["Topics", "Spider chart", "3D view"] as const;

export default function LandscapePreview({
  landscape,
}: {
  landscape: Landscape;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const [onScreen, setOnScreen] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setOnScreen(entry.isIntersecting),
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const count = SLIDES.length;
  const { index, go, next, prev, trackRef, touchHandlers } = useCarousel({
    count,
    enabled: onScreen,
  });

  return (
    <section
      ref={sectionRef}
      id="landscape"
      data-snap-section
      className="flex h-dvh snap-start flex-col pt-6"
    >
      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col px-5">
        {/* Heading, with the way to switch between the two readings */}
        <div className="flex items-center justify-between gap-4 py-6">
          <h2 className="font-display text-2xl text-ink">
            {siteCopy.landscapePreview.heading}
          </h2>
          <div className="flex items-center gap-3">
            <CarouselArrow
              dir="left"
              onClick={prev}
              disabled={index === 0}
              label="Previous view"
            />
            <CarouselDots
              count={count}
              index={index}
              onGo={go}
              labelFor={(i) => `Show ${SLIDES[i]}`}
            />
            <CarouselArrow
              dir="right"
              onClick={next}
              disabled={index === count - 1}
              label="Next view"
            />
          </div>
        </div>

        <CarouselTrack
          index={index}
          trackRef={trackRef}
          touchHandlers={touchHandlers}
        >
          <TopicTiles landscape={landscape} />
          <SpiderView landscape={landscape} />
          <SpaceSlide landscape={landscape} active={index === 2} />
        </CarouselTrack>
      </div>
    </section>
  );
}

/**
 * The topics as numbered tiles: the same list as the spider chart's corners,
 * read straight down. Each is a way into that topic's tensions.
 */
function TopicTiles({ landscape }: { landscape: Landscape }) {
  if (landscape.topics.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="max-w-sm text-center font-display text-xl leading-snug text-ink-soft">
          The landscape is still forming. Add the first views and topics will
          emerge.
        </p>
      </div>
    );
  }

  return (
    <div className="grid h-full grid-cols-1 auto-rows-min content-start overflow-y-auto border-l border-t border-line sm:grid-cols-2 sm:auto-rows-fr sm:content-stretch sm:overflow-hidden">
      {landscape.topics.map((topic, i) => (
        <Link
          key={topic.id}
          href={`/landscape?topic=${i}`}
          className="group flex min-h-[7rem] flex-col justify-between border-r border-b border-line p-6 transition-colors hover:bg-paper-2/60 sm:min-h-0 sm:p-8"
        >
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
            {String(i + 1).padStart(2, "0")}
          </span>
          <span className="max-w-md font-display text-2xl leading-snug text-ink sm:text-3xl md:text-4xl">
            {topic.label}
          </span>
          <span
            aria-hidden
            className="self-end text-2xl text-muted transition-transform group-hover:translate-x-1 group-hover:text-ink"
          >
            →
          </span>
        </Link>
      ))}
    </div>
  );
}
