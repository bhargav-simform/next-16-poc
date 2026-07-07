"use client";

import { useActionState } from "react";
import { ingestRepositoryAction } from "@/actions/ingest-repository.action";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { IngestionActionState } from "@/types/ingestion.types";

const initialState: IngestionActionState = { status: "idle" };

export function IngestForm() {
  const [state, formAction, isPending] = useActionState(ingestRepositoryAction, initialState);

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <form action={formAction} className="flex flex-col gap-3 sm:flex-row">
          <Input
            name="repositoryUrl"
            placeholder="https://github.com/owner/repo"
            required
            disabled={isPending}
            className="h-10 flex-1"
          />
          <Button type="submit" disabled={isPending} className="h-10 sm:w-auto">
            {isPending ? "Ingesting…" : "Ingest repository"}
          </Button>
        </form>

        {state.status === "error" && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.message}
          </p>
        )}

        {isPending && (
          <p className="text-sm text-muted-foreground">
            Cloning, analyzing, and indexing the repository — this can take a while for larger
            projects.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
