/**
 * The contribute page's frame while its starter loads, so tapping a sentence on
 * the home screen lands on something immediately instead of a blank beat.
 */
export default function ContributeLoading() {
  return (
    <div className="flex min-h-dvh flex-col">
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-5 py-10 sm:py-14">
          <span className="inline-flex items-center gap-2 text-sm text-muted">
            Back
          </span>
          <div className="mt-6 h-9 w-3/4 animate-pulse rounded bg-ink/10 sm:h-12" />
          <div className="mt-8 h-40 w-full animate-pulse rounded-[12px] border border-line bg-paper" />
        </div>
      </main>
    </div>
  );
}
