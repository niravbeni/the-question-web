import LoadingDots from "@/components/LoadingDots";

/**
 * Shown the instant a click heads for the landscape, while the server assembles
 * it. Mirrors the topic carousel's frame — full-width top and bottom bars with a
 * quiet centre — so the page appears to arrive at once rather than after a pause.
 */
export default function LandscapeLoading() {
  return (
    <div className="flex h-dvh flex-col">
      <main className="min-h-0 flex-1">
        <div className="flex h-full flex-col">
          <div className="grid grid-cols-3 items-center border-b border-line px-5 py-4 sm:px-8">
            <span className="inline-flex items-center gap-1.5 justify-self-start text-sm font-medium text-muted">
              Back
            </span>
            <span className="justify-self-center text-xs font-medium uppercase tracking-[0.14em] text-muted">
              Loading
            </span>
            <span className="justify-self-end rounded-full bg-ink/15 px-5 py-2.5 text-sm text-transparent">
              Add your view
            </span>
          </div>

          <div className="flex min-h-0 flex-1 items-center justify-center text-ink/55">
            <LoadingDots />
          </div>

          <div className="flex items-center justify-between border-t border-line px-5 py-4 sm:px-8">
            <span className="h-10 w-10 rounded-full border border-line" />
            <span className="h-2 w-6 rounded-full bg-ink/15" />
            <span className="h-10 w-10 rounded-full border border-line" />
          </div>
        </div>
      </main>
    </div>
  );
}
