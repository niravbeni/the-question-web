"use client";

import {
  Children,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
  type TouchEvent as ReactTouchEvent,
} from "react";

/**
 * Carousel mechanics shared by the home landscape preview and the topic
 * carousel: a bounded index with swipe, horizontal-trackpad and arrow-key
 * navigation. The chrome (heading, dots, arrows) lives at each call site so a
 * carousel embedded in a snap-scroll page and one that owns its whole page can
 * frame themselves differently. Key and wheel handling can be gated with
 * `enabled` so a carousel that shares the window with other screens only
 * listens while it is the one on view.
 */

interface TouchHandlers {
  onTouchStart: (e: ReactTouchEvent) => void;
  onTouchEnd: (e: ReactTouchEvent) => void;
}

export interface Carousel {
  index: number;
  go: (i: number) => void;
  next: () => void;
  prev: () => void;
  trackRef: RefObject<HTMLDivElement | null>;
  touchHandlers: TouchHandlers;
}

export function useCarousel({
  count,
  initial = 0,
  enabled = true,
}: {
  count: number;
  initial?: number;
  enabled?: boolean;
}): Carousel {
  const clamp = (i: number) => Math.max(0, Math.min(count - 1, i));
  const [index, setIndex] = useState(() => clamp(initial));
  const go = (i: number) => setIndex(clamp(i));
  const next = () => setIndex((i) => Math.min(count - 1, i + 1));
  const prev = () => setIndex((i) => Math.max(0, i - 1));

  // Left/right arrow keys step between slides, but only while this carousel is
  // the one in view, so a page with several screens does not fight over them.
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight") setIndex((i) => Math.min(count - 1, i + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [count, enabled]);

  // Horizontal trackpad scrolling rotates the carousel. A short lock keeps one
  // continuous gesture from skipping several slides at once. Vertical scroll is
  // left alone so an enclosing snap-scroll page keeps working.
  const trackRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = trackRef.current;
    if (!el || !enabled) return;
    let accum = 0;
    let locked = false;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      if (locked) return;
      accum += e.deltaX;
      if (Math.abs(accum) > 60) {
        const dir = accum > 0 ? 1 : -1;
        setIndex((i) => Math.max(0, Math.min(count - 1, i + dir)));
        accum = 0;
        locked = true;
        setTimeout(() => {
          locked = false;
        }, 550);
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [count, enabled]);

  // Basic swipe support.
  const touchX = useRef<number | null>(null);
  const touchHandlers: TouchHandlers = {
    onTouchStart: (e) => {
      touchX.current = e.touches[0].clientX;
    },
    onTouchEnd: (e) => {
      if (touchX.current === null) return;
      const dx = e.changedTouches[0].clientX - touchX.current;
      touchX.current = null;
      if (Math.abs(dx) > 48) go(index + (dx < 0 ? 1 : -1));
    },
  };

  return { index, go, next, prev, trackRef, touchHandlers };
}

/**
 * The sliding strip. Each child becomes one full-width slide; the strip is
 * translated to bring the active one into view and off-screen slides are made
 * inert so nothing behind the current slide can be tabbed to or read out.
 */
export function CarouselTrack({
  index,
  trackRef,
  touchHandlers,
  children,
}: {
  index: number;
  trackRef: RefObject<HTMLDivElement | null>;
  touchHandlers: TouchHandlers;
  children: ReactNode;
}) {
  const slides = Children.toArray(children);
  return (
    <div
      ref={trackRef}
      className="min-h-0 flex-1 overflow-hidden overscroll-x-contain"
      {...touchHandlers}
    >
      <div
        className="flex h-full transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {slides.map((child, i) => (
          <section
            key={i}
            inert={i !== index}
            aria-hidden={i !== index}
            className={
              "h-full w-full shrink-0 overflow-hidden transition-opacity duration-500 " +
              (i === index ? "opacity-100" : "opacity-0")
            }
          >
            {child}
          </section>
        ))}
      </div>
    </div>
  );
}

/** The row of position dots; the active one stretches into a pill. */
export function CarouselDots({
  count,
  index,
  onGo,
  labelFor,
}: {
  count: number;
  index: number;
  onGo: (i: number) => void;
  labelFor?: (i: number) => string;
}) {
  return (
    <div className="flex gap-2">
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          onClick={() => onGo(i)}
          aria-label={labelFor ? labelFor(i) : `Show slide ${i + 1}`}
          className={
            i === index
              ? "h-2 w-6 rounded-full bg-ink transition-all duration-300"
              : "h-2 w-2 rounded-full bg-ink/20 transition-all duration-300 hover:bg-ink/40"
          }
        />
      ))}
    </div>
  );
}

/** A round previous/next control that dims at the ends of the carousel. */
export function CarouselArrow({
  dir,
  onClick,
  disabled,
  label,
}: {
  dir: "left" | "right";
  onClick: () => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={
        "flex h-10 w-10 items-center justify-center rounded-full border transition-colors " +
        (disabled
          ? "border-line text-muted/50"
          : "border-line text-ink hover:border-ink/40")
      }
    >
      <Chevron dir={dir} />
    </button>
  );
}

export function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      className={dir === "right" ? "-scale-x-100" : undefined}
    >
      <path
        d="M9.5 3.5 5 8l4.5 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
