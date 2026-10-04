export type Severity = "Critical" | "High" | "Medium" | "Low" | "Informational";

export type Finding = {
  id: string;
  ruleId: string;
  title: string;
  severity: Severity;
  category: string;
  confidence: string;
  file: string;
  line: number;
  column: number;
  evidence: string;
  maskedEvidence: string;
  description: string;
  impact: string;
  remediation: string;
  verification: string;
  references: string[];
  status: "Open" | "Resolved" | "False Positive" | "Ignored";
};

export type ProjectFile = {
  path: string;
  content: string;
};

export type ScanSummary = {
  totalFindings: number;
  score: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  informational: number;
  filesAnalyzed: number;
  languages: string[];
  dependencies: number;
};

export type ScanResult = {
  id: string;
  projectName: string;
  scannedAt: string;
  summary: ScanSummary;
  findings: Finding[];
};
