"use client";

import { RefreshCw } from "lucide-react";
import { useTransition } from "react";
import { reanalyzeRepositoryAction } from "@/actions/reanalyze-repository.action";
import { Button } from "@/components/ui/button";

export function RefreshAnalysisButton({ repositoryId }: { repositoryId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() => startTransition(() => reanalyzeRepositoryAction(repositoryId))}
    >
      <RefreshCw className={isPending ? "animate-spin" : undefined} />
      {isPending ? "Refreshing…" : "Refresh analysis"}
    </Button>
  );
}
