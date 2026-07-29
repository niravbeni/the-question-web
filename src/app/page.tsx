import Link from "next/link";
import Header from "@/components/Header";
import SnapHashScroll from "@/components/SnapHashScroll";
import { siteCopy } from "@/content/copy";
import { getLandscape, getStarters } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  await ensureSeeded();
  const [landscape, starters] = await Promise.all([getLandscape(), getStarters()]);
  const sorted = [...starters].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    // The page is its own scroll container so each screen snaps into place.
    <div className="h-dvh snap-y snap-mandatory overflow-y-auto scroll-smooth">
      <SnapHashScroll />
      <Header />

      {/* Screen 1: hero */}
      <section className="flex min-h-dvh snap-start flex-col justify-center border-b border-line">
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
              href="/landscape"
              className="rounded-full border border-line px-6 py-3 text-sm font-medium text-ink hover:border-ink/40"
            >
              {siteCopy.hero.secondaryCta}
            </Link>
          </div>
        </div>
      </section>

      {/* Screen 2: sentence starters, rows folding down to the screen edge */}
      <section
        id="starters"
        className="flex h-dvh snap-start flex-col border-b border-line pt-16"
      >
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5">
          <h2 className="py-6 font-display text-2xl text-ink">
            {siteCopy.starters.heading}
          </h2>
          <div className="flex flex-1 flex-col divide-y divide-line border-t border-line">
            {sorted.map((starter) => (
              <Link
                key={starter.id}
                href={`/contribute/${starter.id}`}
                className="group flex flex-1 items-center justify-between gap-6 transition-colors hover:bg-paper-2/60"
              >
                <span className="max-w-4xl font-display text-2xl leading-snug text-ink sm:text-4xl">
                  {starter.text}
                </span>
                <span
                  aria-hidden
                  className="shrink-0 text-2xl text-muted transition-transform group-hover:translate-x-1 group-hover:text-ink sm:text-3xl"
                >
                  →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Screen 3: landscape preview, footer pinned to its bottom */}
      <section className="flex min-h-dvh snap-start flex-col">
        <div className="flex flex-1 flex-col justify-center">
          <div className="mx-auto w-full max-w-6xl px-5">
            <h2 className="font-display text-2xl text-ink">
              {siteCopy.landscapePreview.heading}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              {siteCopy.landscapePreview.tagline}
            </p>
            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {landscape.topics.map((topic) => (
                <li
                  key={topic.id}
                  className="rounded-[12px] border border-line p-5"
                >
                  <h3 className="font-display text-base text-ink">{topic.label}</h3>
                </li>
              ))}
            </ul>
            <Link
              href="/landscape"
              className="mt-8 inline-block rounded-full border border-line px-6 py-3 text-sm font-medium text-ink hover:border-ink/40"
            >
              {siteCopy.landscapePreview.cta}
            </Link>
          </div>
        </div>
        <footer className="border-t border-line">
          <div className="mx-auto max-w-6xl px-5 py-8 text-xs text-muted">
            <span>
              {siteCopy.projectTitle} · {siteCopy.projectSubtitle}
            </span>
          </div>
        </footer>
      </section>
    </div>
  );
}
