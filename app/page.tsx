import { IngestForm } from "@/components/ingest-form";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-xl font-semibold">Repository Ingestion</h1>
      <IngestForm />
    </div>
  );
}
