import Header from "@/components/Header";
import AdminView from "@/components/AdminView";

export const dynamic = "force-dynamic";

/** Prototype-only data admin. Local testing tool: not linked from the site. */
export default function AdminPage() {
  return (
    <>
      <Header />
      <AdminView />
    </>
  );
}
