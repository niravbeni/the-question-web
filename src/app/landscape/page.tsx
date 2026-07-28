import Header from "@/components/Header";
import LandscapeView from "@/components/LandscapeView";
import { getLandscape } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

export default async function LandscapePage({
  searchParams,
}: {
  searchParams: Promise<{ pov?: string }>;
}) {
  const { pov } = await searchParams;
  await ensureSeeded();
  const landscape = await getLandscape();

  return (
    <>
      <Header />
      <LandscapeView landscape={landscape} focusPovId={pov ?? null} />
    </>
  );
}
