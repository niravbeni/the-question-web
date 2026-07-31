import { redirect } from "next/navigation";
import TopicCarousel from "@/components/TopicCarousel";
import { getLandscape } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

/**
 * The landscape as a carousel of topics, one topic's tensions per slide.
 * The opening slide is chosen from, in order: an explicit ?topic=i, the topic
 * holding a ?pov= voice (where someone lands right after publishing), else the
 * first topic.
 */
export default async function LandscapePage({
  searchParams,
}: {
  searchParams: Promise<{ pov?: string; topic?: string; view?: string }>;
}) {
  const { pov, topic, view } = await searchParams;

  // The classic carousel folded into this page; keep old links working.
  if (view !== undefined) redirect("/landscape");

  await ensureSeeded();
  const landscape = await getLandscape();
  const lastTopic = landscape.topics.length - 1;

  const parsed = topic !== undefined ? Number.parseInt(topic, 10) : NaN;
  let initialIndex = Number.isNaN(parsed)
    ? -1
    : Math.max(0, Math.min(lastTopic, parsed));

  if (initialIndex < 0 && pov) {
    const point = landscape.spiderPoints.find((p) => p.povId === pov);
    if (point) {
      initialIndex = landscape.topics.findIndex((t) => t.id === point.topicId);
    }
  }
  if (initialIndex < 0) initialIndex = 0;

  return (
    <div className="flex h-dvh flex-col">
      <TopicCarousel
        landscape={landscape}
        initialIndex={initialIndex}
        focusPovId={pov ?? null}
      />
    </div>
  );
}
