import { redirect } from "next/navigation";
import { Suspense } from "react";
import { VotingList } from "@/components/admin/voting-list";
import { isAdmin } from "@/lib/auth";
import { getAdminVotingList } from "@/lib/queries";

const ListGate = async () => {
  if (!(await isAdmin())) redirect("/admin/login");
  return <VotingList votings={await getAdminVotingList()} />;
};

const AdminPage = () => (
  <main className="stage">
    <Suspense fallback={<p className="tag animate-pulse">Підключення…</p>}>
      <ListGate />
    </Suspense>
  </main>
);

export default AdminPage;
