import Header from "@/components/Header";
import LandscapeView from "@/components/LandscapeView";
import SpiderView from "@/components/SpiderView";
import TopicTensions from "@/components/TopicTensions";
import { getLandscape } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

/**
 * Three ways to read the same landscape:
 * - default: the spider chart, every topic a corner and every voice inside it
 * - ?topic=i: that topic's tensions
 * - ?view=classic: the original topic carousel, kept as an alternate
 */
export default async function LandscapePage({
  searchParams,
}: {
  searchParams: Promise<{ pov?: string; topic?: string; view?: string }>;
}) {
  const { pov, topic, view } = await searchParams;
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
      {view === "classic" ? (
        <LandscapeView
          landscape={landscape}
          focusPovId={focusPovId}
          initialTopic={topicIndex}
          switchHref="/landscape"
        />
      ) : selected && topicIndex !== null ? (
        <TopicTensions
          topic={selected}
          index={topicIndex}
          count={landscape.topics.length}
          focusPovId={focusPovId}
        />
      ) : (
        <SpiderView landscape={landscape} focusPovId={focusPovId} />
      )}
    </div>
  );
}
