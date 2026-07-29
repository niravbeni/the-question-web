import Header from "@/components/Header";
import LandscapeView from "@/components/LandscapeView";
import { getLandscape } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

export default async function LandscapePage({
  searchParams,
}: {
  searchParams: Promise<{ pov?: string; topic?: string }>;
}) {
  const { pov, topic } = await searchParams;
  await ensureSeeded();
  const landscape = await getLandscape();
  const topicIndex = topic !== undefined ? Number.parseInt(topic, 10) : null;

  return (
    <div className="flex h-dvh flex-col">
      <Header />
      <LandscapeView
        landscape={landscape}
        focusPovId={pov ?? null}
        initialTopic={Number.isNaN(topicIndex) ? null : topicIndex}
      />
    </div>
  );
}
