import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { RevealShow } from "@/components/reveal/reveal-show";
import { isAdmin } from "@/lib/auth";
import { getAdminSnapshot } from "@/lib/queries";

export const metadata: Metadata = { title: "Шоу результатів" };

type Params = PageProps<"/admin/v/[id]/reveal">["params"];

const RevealGate = async ({ params }: { params: Params }) => {
  if (!(await isAdmin())) redirect("/admin/login");
  const snapshot = await getAdminSnapshot((await params).id);
  if (!snapshot) notFound();
  return <RevealShow snapshot={snapshot} />;
};

const RevealPage = ({ params }: PageProps<"/admin/v/[id]/reveal">) => (
  <Suspense fallback={<div className="fixed inset-0 bg-[#07070b]" />}>
    <RevealGate params={params} />
  </Suspense>
);

export default RevealPage;
