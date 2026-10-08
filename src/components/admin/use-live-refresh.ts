"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ADMIN_LIVE_REFRESH_MS } from "@/config/voting";

/** Re-fetches the server component on an interval so counts and charts stay live. */
export const useLiveRefresh = () => {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (!document.hidden) router.refresh();
    }, ADMIN_LIVE_REFRESH_MS);
    return () => clearInterval(id);
  }, [router]);
};
