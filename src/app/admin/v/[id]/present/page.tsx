import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { PresentScreen } from "@/components/admin/present-screen";
import { isAdmin } from "@/lib/auth";
import { getAdminSnapshot } from "@/lib/queries";

export const metadata: Metadata = { title: "QR для голосування" };

type Params = PageProps<"/admin/v/[id]/present">["params"];

const PresentGate = async ({ params }: { params: Params }) => {
  if (!(await isAdmin())) redirect("/admin/login");
  const snapshot = await getAdminSnapshot((await params).id);
  if (!snapshot) notFound();
  return <PresentScreen snapshot={snapshot} />;
};

const PresentPage = ({ params }: PageProps<"/admin/v/[id]/present">) => (
  <Suspense fallback={null}>
    <PresentGate params={params} />
  </Suspense>
);

export default PresentPage;
