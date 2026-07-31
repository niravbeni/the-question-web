import Link from "next/link";
import SnapHashScroll from "@/components/SnapHashScroll";
import LandscapePreview from "@/components/LandscapePreview";
import { siteCopy } from "@/content/copy";
import { getLandscape, getStarters } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";

// The home page is a shared, read-only snapshot (starters + landscape). Caching
// it as a static/ISR page lets the "Back" links from contribute and landscape
// fully prefetch it, so returning to it is instant instead of a fresh dynamic
// render. Writes (publishing a view, recalibrating, editing starters) call
// revalidatePath("/") to refresh the snapshot on demand; this number is only a
// backstop for anything that changes data outside those paths.
export const revalidate = 300;

export default async function LandingPage() {
  await ensureSeeded();
  const [landscape, starters] = await Promise.all([getLandscape(), getStarters()]);
  const sorted = [...starters].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    // The page is its own scroll container so each screen snaps into place.
    <div
      className="h-dvh snap-y snap-mandatory overflow-y-auto scroll-smooth"
      data-snap-scroll
    >
      <SnapHashScroll />

      {/* Screen 1: hero. Carries the one quiet way back out to the parent site,
          sitting where the header wordmark used to be. */}
      <section
        data-snap-section
        className="relative flex min-h-dvh snap-start flex-col justify-center border-b border-line"
      >
        <div className="absolute inset-x-0 top-0">
          <div className="mx-auto max-w-6xl px-5 pt-5">
            <Link
              href={siteCopy.parentSite.url}
              className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink"
            >
              <span aria-hidden>←</span>
              {siteCopy.parentSite.label}
            </Link>
          </div>
        </div>
        <div className="mx-auto w-full max-w-6xl px-5">
          <h1 className="max-w-4xl font-display text-5xl leading-[1.05] text-ink sm:text-7xl">
            {siteCopy.hero.headline}
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-ink-soft">
            {siteCopy.hero.paragraph}
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href="/#starters"
              className="rounded-full bg-ink px-6 py-3 text-sm font-medium text-paper hover:bg-ink/85"
            >
              {siteCopy.hero.primaryCta}
            </Link>
            <Link
              href="/#landscape"
              className="rounded-full border border-line px-6 py-3 text-sm font-medium text-ink hover:border-ink/40"
            >
              {siteCopy.hero.secondaryCta}
            </Link>
          </div>
        </div>
      </section>

      {/* Screen 2: sentence starters, full-bleed rows folding down to the screen edge */}
      <section
        id="starters"
        data-snap-section
        className="flex h-dvh snap-start flex-col border-b border-line pt-6"
      >
        <div className="mx-auto w-full max-w-6xl px-5">
          <h2 className="py-6 font-display text-2xl text-ink">
            {siteCopy.starters.heading}
          </h2>
        </div>
        <div className="flex flex-1 flex-col divide-y divide-line border-t border-line">
          {sorted.map((starter) => (
            <Link
              key={starter.id}
              href={`/contribute/${starter.id}`}
              className="group flex flex-1 items-center transition-colors hover:bg-paper-2/60"
            >
              <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-5">
                <span className="max-w-4xl font-display text-2xl leading-snug text-ink sm:text-4xl">
                  {starter.text}
                </span>
                <span
                  aria-hidden
                  className="shrink-0 text-2xl text-muted transition-transform group-hover:translate-x-1 group-hover:text-ink sm:text-3xl"
                >
                  →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Screen 3: the landscape as a carousel of the topic tiles and the spider chart */}
      <LandscapePreview landscape={landscape} />
    </div>
  );
}
