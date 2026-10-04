import type { ScanResult } from "@/lib/types";

const sampleResult: ScanResult = {
  id: "sample-scan",
  projectName: "sample-report",
  scannedAt: "2026-10-04T12:00:00.000Z",
  summary: {
    totalFindings: 5,
    score: 63,
    critical: 0,
    high: 2,
    medium: 2,
    low: 1,
    informational: 0,
    filesAnalyzed: 9,
    languages: ["JavaScript", "TypeScript", "JSON"],
    dependencies: 5,
  },
  findings: [
    {
      id: "sample-1",
      ruleId: "SECRET-001",
      title: "Potential hardcoded secret detected",
      severity: "High",
      category: "Secrets",
      confidence: "High Confidence",
      file: "src/config.ts",
      line: 8,
      column: 18,
      evidence: "sk_live_4B93i4kD29Yx80t66f8d",
      maskedEvidence: "sk_l•••••••••••••6f8d",
      description: "A credential-like value was found in source code and may be exposed in a repository or client bundle.",
      impact: "Attackers may use the exposed value to interact with third-party services with the application’s privileges.",
      remediation: "Store the value in a server-only environment variable or managed secret vault and avoid committing it to version control.",
      verification: "Confirm the value has been removed from the source tree and is now loaded only from a secure deployment environment.",
      references: ["https://owasp.org/www-project-top-ten/"],
      status: "Open",
    },
    {
      id: "sample-2",
      ruleId: "CODE-001",
      title: "Dynamic code execution pattern",
      severity: "High",
      category: "Code Execution",
      confidence: "Confirmed Pattern",
      file: "src/handlers.ts",
      line: 17,
      column: 14,
      evidence: "eval(userInput)",
      maskedEvidence: "eval(userInput)",
      description: "The application uses a dynamic code execution mechanism that can execute attacker-controlled JavaScript.",
      impact: "If user-provided data reaches the eval call, arbitrary JavaScript execution may occur inside the application runtime.",
      remediation: "Replace the dynamic evaluation with explicit logic or a trusted parser that does not execute code from raw input.",
      verification: "Verify that no untrusted string reaches the eval call and that the code uses a safe alternative.",
      references: ["https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/eval"],
      status: "Open",
    },
    {
      id: "sample-3",
      ruleId: "SSRF-001",
      title: "Potential server-side request forgery pattern",
      severity: "Medium",
      category: "Server Security",
      confidence: "Medium Confidence",
      file: "src/api/proxy.ts",
      line: 23,
      column: 9,
      evidence: "fetch(userProvidedUrl)",
      maskedEvidence: "fetch(userProvidedUrl)",
      description: "The server fetches a URL supplied by input data, which is a classic SSRF pattern when not constrained.",
      impact: "A remote attacker may coerce the server to contact internal or sensitive services.",
      remediation: "Validate the URL against an allowlist and restrict schemes, hosts, and ports to approved destinations only.",
      verification: "Review the request target and confirm external callers cannot supply arbitrary internal service URLs.",
      references: ["https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html"],
      status: "Open",
    },
  ],
};

const severityStyles: Record<string, string> = {
  Critical: "bg-red-600/20 text-red-100 ring-red-500/30",
  High: "bg-orange-600/20 text-orange-100 ring-orange-500/30",
  Medium: "bg-yellow-600/20 text-yellow-100 ring-yellow-500/30",
  Low: "bg-sky-600/20 text-sky-100 ring-sky-500/30",
  Informational: "bg-zinc-600/20 text-zinc-100 ring-zinc-500/30",
};

export default function SamplePage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="mb-8 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          SAMPLE REPORT — Demonstration data only. This report is not from your uploaded project.
        </div>

        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Proofline / Private Beta</p>
            <h1 className="mt-3 text-4xl font-semibold">{sampleResult.projectName}</h1>
          </div>
          <div className="rounded-2xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-3 text-right">
            <div className="text-xs uppercase tracking-[0.2em] text-cyan-200">Security Score</div>
            <div className="mt-2 text-3xl font-bold">{sampleResult.summary.score}/100</div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          {[
            ["Total Findings", sampleResult.summary.totalFindings],
            ["High", sampleResult.summary.high],
            ["Medium", sampleResult.summary.medium],
            ["Files", sampleResult.summary.filesAnalyzed],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-zinc-400">{label}</div>
              <div className="mt-3 text-3xl font-semibold text-white">{value}</div>
            </div>
          ))}
        </div>

        <div className="mt-10 overflow-hidden rounded-2xl border border-zinc-800">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-900 text-zinc-300">
              <tr>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Finding</th>
                <th className="px-4 py-3">File</th>
                <th className="px-4 py-3">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {sampleResult.findings.map((finding) => (
                <tr key={finding.id} className="border-t border-zinc-800 bg-zinc-950/50">
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${severityStyles[finding.severity]}`}>
                      {finding.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white">{finding.title}</td>
                  <td className="px-4 py-3 text-zinc-300">{finding.file}</td>
                  <td className="px-4 py-3 text-zinc-300">{finding.confidence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
