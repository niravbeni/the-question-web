import { redirect } from "next/navigation";
import Header from "@/components/Header";
import LandscapeOverview from "@/components/LandscapeOverview";
import TopicTensions from "@/components/TopicTensions";
import { getLandscape } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

/**
 * Two ways to read the same landscape:
 * - default: the overview carousel (spider chart and topic grid, side by side)
 * - ?topic=i: that topic's tensions
 */
export default async function LandscapePage({
  searchParams,
}: {
  searchParams: Promise<{ pov?: string; topic?: string; view?: string }>;
}) {
  const { pov, topic, view } = await searchParams;

  // The classic carousel has folded into the overview; keep old links working.
  if (view !== undefined) redirect("/landscape");

  await ensureSeeded();
  const landscape = await getLandscape();

  const parsed = topic !== undefined ? Number.parseInt(topic, 10) : NaN;
  const topicIndex = Number.isNaN(parsed)
    ? null
    : Math.max(0, Math.min(landscape.topics.length - 1, parsed));
  const focusPovId = pov ?? null;
  const selected = topicIndex !== null ? landscape.topics[topicIndex] : null;

  return (
    <div className="flex h-dvh flex-col">
      <Header />
      {selected && topicIndex !== null ? (
        <TopicTensions
          topic={selected}
          index={topicIndex}
          count={landscape.topics.length}
          focusPovId={focusPovId}
        />
      ) : (
        <LandscapeOverview landscape={landscape} focusPovId={focusPovId} />
      )}
    </div>
  );
}
