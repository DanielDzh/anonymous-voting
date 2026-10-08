"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/view-models";

/** Runs a server action in a transition and keeps its last error for display. */
export const useAdminAction = () => {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const run = <T,>(action: () => Promise<ActionResult<T>>, onSuccess?: (data: T) => void) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) onSuccess?.(result.data);
      else setError(result.error);
    });
  };

  return { error, isPending, run };
};
