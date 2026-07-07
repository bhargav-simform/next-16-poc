import { IngestForm } from "@/components/ingest-form";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 sm:px-8">
      <div className="flex w-full max-w-xl flex-col items-center gap-3 text-center">
        <span className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Code Analyzer
        </span>
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Understand any repository in minutes
        </h1>
        <p className="max-w-md text-sm text-muted-foreground sm:text-base">
          Paste a public GitHub URL to run static analysis, get AI-generated insights, and chat
          with your codebase — all powered locally.
        </p>
      </div>

      <div className="mt-10 w-full max-w-xl">
        <IngestForm />
      </div>
    </div>
  );
}
