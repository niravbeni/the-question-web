import Header from "@/components/Header";
import VisualisationsView from "@/components/VisualisationsView";
import { getLandscape } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

/** Standalone 3D view of the landscape. Not linked from the main flow. */
export default async function VisualisationsPage() {
  await ensureSeeded();
  const landscape = await getLandscape();

  return (
    <>
      <Header />
      <VisualisationsView landscape={landscape} />
    </>
  );
}
