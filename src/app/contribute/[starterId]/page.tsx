import { notFound } from "next/navigation";
import Header from "@/components/Header";
import ContributeFlow from "@/components/ContributeFlow";
import { getStarterById } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ContributePage({
  params,
}: {
  params: Promise<{ starterId: string }>;
}) {
  const { starterId } = await params;
  const starter = await getStarterById(starterId);
  if (!starter) notFound();

  return (
    <>
      <Header />
      <ContributeFlow starter={starter} />
    </>
  );
}
