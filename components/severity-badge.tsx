import { Badge } from "@/components/ui/badge";
import type { IssueSeverity } from "@/types/analysis.types";

const SEVERITY_VARIANT: Record<IssueSeverity, "destructive" | "secondary" | "outline"> = {
  critical: "destructive",
  high: "destructive",
  medium: "secondary",
  low: "outline",
};

const SEVERITY_LABEL: Record<IssueSeverity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export function SeverityBadge({ severity }: { severity: IssueSeverity }) {
  return <Badge variant={SEVERITY_VARIANT[severity]}>{SEVERITY_LABEL[severity]}</Badge>;
}
