import LoadingDots from "@/components/LoadingDots";

/**
 * A whisper-light fallback for routes without their own (the home and about
 * pages), so returning to them registers the click at once instead of holding
 * on the previous screen while the next one is built.
 */
export default function RootLoading() {
  return (
    <div className="flex h-dvh items-center justify-center text-ink/55">
      <LoadingDots />
    </div>
  );
}
