import Link from "next/link";
import Header from "@/components/Header";
import { siteCopy } from "@/content/copy";

export default function AboutPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-5 py-20">
          <h1 className="font-display text-3xl text-ink">
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
              href="/landscape"
              className="rounded-full border border-line px-6 py-3 text-sm font-medium text-ink hover:border-ink/40"
            >
              {siteCopy.hero.secondaryCta}
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
