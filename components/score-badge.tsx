function scoreTone(score: number): string {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400 border-emerald-600/30 bg-emerald-600/10";
  if (score >= 50) return "text-amber-600 dark:text-amber-400 border-amber-600/30 bg-amber-600/10";
  return "text-destructive border-destructive/30 bg-destructive/10";
}

export function ScoreBadge({ score }: { score: number }) {
  return (
    <div
      className={`flex size-16 shrink-0 flex-col items-center justify-center rounded-full border-2 font-semibold ${scoreTone(score)}`}
    >
      <span className="text-xl leading-none">{score}</span>
      <span className="text-[10px] leading-none text-muted-foreground">/ 100</span>
    </div>
  );
}
