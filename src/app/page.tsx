import Link from "next/link";
import Header from "@/components/Header";
import { starters } from "@/content/starters";
import { siteCopy } from "@/content/copy";
import { getLandscape } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  await ensureSeeded();
  const landscape = await getLandscape();
  const sorted = [...starters].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <>
      <Header />
      <main className="flex-1">
        {/* Hero */}
        <section className="border-b border-line">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:py-28">
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

        {/* Sentence starters: the core interaction, huge and up front */}
        <section id="starters" className="scroll-mt-20 border-b border-line">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
            <h2 className="font-display text-2xl text-ink">
              {siteCopy.starters.heading}
            </h2>
            <div className="mt-10 divide-y divide-line border-t border-b border-line">
              {sorted.map((starter) => (
                <Link
                  key={starter.id}
                  href={`/contribute/${starter.id}`}
                  className="group flex items-center justify-between gap-6 py-8 transition-colors hover:bg-paper-2/60 sm:py-10"
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

        {/* Landscape preview */}
        <section className="border-b border-line">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <h2 className="font-display text-2xl text-ink">
              {siteCopy.landscapePreview.heading}
            </h2>
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
        </section>

        {/* Closing invitation */}
        <section>
          <div className="mx-auto max-w-6xl px-5 py-20 text-center">
            <h2 className="mx-auto max-w-2xl font-display text-2xl text-ink sm:text-3xl">
              {siteCopy.closing.heading}
            </h2>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/#starters"
                className="rounded-full bg-ink px-6 py-3 text-sm font-medium text-paper hover:bg-ink/85"
              >
                {siteCopy.closing.primaryCta}
              </Link>
              <Link
                href="/landscape"
                className="rounded-full border border-line px-6 py-3 text-sm font-medium text-ink hover:border-ink/40"
              >
                {siteCopy.closing.secondaryCta}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto max-w-6xl px-5 py-8 text-xs text-muted">
          <span>
            {siteCopy.projectTitle} · {siteCopy.projectSubtitle}
          </span>
        </div>
      </footer>
    </>
  );
}
