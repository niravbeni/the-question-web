import { notFound } from "next/navigation";
import ContributeFlow from "@/components/ContributeFlow";
import { getStarterById } from "@/lib/db";
import { defaultStarters } from "@/content/starters";

/**
 * A contribute page is just its chosen sentence and an empty box, so it is
 * cached as static HTML instead of rebuilt on every click — that is what keeps
 * arriving here instant (the route is prefetched and served from the cache
 * with no database round-trip in the click's path).
 *
 * The sentence itself still comes from the database, so an edit made in the
 * admin screen remains the source of truth. `revalidate` rebuilds the page in
 * the background as a slow backstop, and the admin save clears this exact page
 * on demand (see the starters API), so an edited question shows up on the very
 * next load rather than a click later.
 */
export const revalidate = 3600;

export function generateStaticParams() {
  return defaultStarters.map((starter) => ({ starterId: starter.id }));
}

export default async function ContributePage({
  params,
}: {
  params: Promise<{ starterId: string }>;
}) {
  const { starterId } = await params;
  const starter = await getStarterById(starterId);
  if (!starter) notFound();

  return (
    <div className="flex min-h-dvh flex-col">
      <ContributeFlow starter={starter} />
    </div>
  );
}
