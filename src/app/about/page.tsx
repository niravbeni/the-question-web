import Link from "next/link";
import { siteCopy } from "@/content/copy";

export default function AboutPage() {
  return (
    <main className="flex-1">
      <div className="mx-auto max-w-3xl px-5 py-20">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-ink"
        >
          <svg
            viewBox="0 0 16 16"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M9.5 3.5L5 8l4.5 4.5" />
          </svg>
          {siteCopy.projectTitle}
        </Link>
        <h1 className="mt-8 font-display text-3xl text-ink">
          {siteCopy.about.heading}
        </h1>
        <div className="mt-8 space-y-5">
          {siteCopy.about.body.map((p, i) => (
            <p key={i} className="text-base leading-relaxed text-ink-soft">
              {p}
            </p>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
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
    </main>
  );
}
