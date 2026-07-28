import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { siteCopy } from "@/content/copy";

/**
 * Finds an IDEO logo in /public if one has been uploaded. Drop a file named
 * ideo-logo.svg (or .png) into public/ and it replaces the text wordmark.
 */
function findLogo(): string | null {
  for (const f of ["ideo-logo.svg", "ideo-logo.png", "ideo.svg", "ideo.png"]) {
    if (fs.existsSync(path.join(process.cwd(), "public", f))) return `/${f}`;
  }
  return null;
}

/** Sticky, always-visible header. */
export default function Header() {
  const logo = findLogo();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
        <Link href="/" className="flex items-center gap-3">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="IDEO" className="h-5 w-auto" />
          ) : (
            <span className="font-display text-base font-bold tracking-tight text-ink">
              IDEO
            </span>
          )}
          <span aria-hidden className="h-4 w-px bg-line" />
          <span className="font-display text-base text-ink">
            {siteCopy.projectTitle}
          </span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/#starters"
            className="rounded-full px-3 py-1.5 text-sm font-medium text-ink-soft transition-colors hover:bg-paper-2 hover:text-ink"
          >
            Share your view
          </Link>
          <Link
            href="/landscape"
            className="rounded-full px-3 py-1.5 text-sm font-medium text-ink-soft transition-colors hover:bg-paper-2 hover:text-ink"
          >
            The landscape
          </Link>
          <Link
            href="/about"
            className="hidden rounded-full px-3 py-1.5 text-sm font-medium text-ink-soft transition-colors hover:bg-paper-2 hover:text-ink sm:inline-block"
          >
            About
          </Link>
        </nav>
      </div>
    </header>
  );
}
