import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { isAdmin } from "@/lib/auth";
import { getAdminSnapshot } from "@/lib/queries";

type Params = PageProps<"/admin/v/[id]">["params"];

const VotingGate = async ({ params }: { params: Params }) => {
  if (!(await isAdmin())) redirect("/admin/login");
  const snapshot = await getAdminSnapshot((await params).id);
  if (!snapshot) notFound();
  return <AdminDashboard snapshot={snapshot} />;
};

const AdminVotingPage = ({ params }: PageProps<"/admin/v/[id]">) => (
  <main className="stage">
    <Suspense fallback={<p className="tag animate-pulse">Підключення…</p>}>
      <VotingGate params={params} />
    </Suspense>
  </main>
);

export default AdminVotingPage;
