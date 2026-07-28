import { notFound } from "next/navigation";
import Header from "@/components/Header";
import ContributeFlow from "@/components/ContributeFlow";
import { getStarter } from "@/content/starters";

export default async function ContributePage({
  params,
}: {
  params: Promise<{ starterId: string }>;
}) {
  const { starterId } = await params;
  const starter = getStarter(starterId);
  if (!starter) notFound();

  return (
    <>
      <Header />
      <ContributeFlow starter={starter} />
    </>
  );
}
