import { Suspense } from "react";
import TopicCarousel from "@/components/TopicCarousel";
import LandscapeLoading from "@/app/landscape/loading";
import { getLandscape } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";

/**
 * The landscape as a carousel of topics, one topic's tensions per slide. The
 * assembled landscape is the same for every visitor, so this is a cached
 * (ISR) page that the topic tiles on the home page can fully prefetch, making
 * the click into it instant. Which slide opens is decided on the client from
 * the URL (?topic=i, else the topic holding ?pov=, else the first), so the
 * page itself stays static; writes revalidate it on demand.
 */
export const revalidate = 300;

export default async function LandscapePage() {
  await ensureSeeded();
  const landscape = await getLandscape();

  // TopicCarousel reads the opening slide from the URL via useSearchParams,
  // which suspends during prerender, so it lives behind a Suspense boundary.
  return (
    <div className="flex h-dvh flex-col">
      <Suspense fallback={<LandscapeLoading />}>
        <TopicCarousel landscape={landscape} />
      </Suspense>
    </div>
  );
}
