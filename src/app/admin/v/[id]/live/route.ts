import type { NextRequest } from "next/server";
import { isAdmin } from "@/lib/auth";
import { store } from "@/lib/store";

/**
 * Live numbers for the projector screen: a few hundred bytes polled every ~1.5 s, instead of
 * re-rendering the whole page (QR and photos) each time. Admin-only, like the screen itself.
 */
export const GET = async (_request: NextRequest, context: RouteContext<"/admin/v/[id]/live">) => {
  if (!(await isAdmin())) return Response.json({ error: "unauthorized" }, { status: 401 });
  const stats = await store.getLiveStats((await context.params).id);
  if (!stats) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(stats, { headers: { "Cache-Control": "no-store" } });
};
