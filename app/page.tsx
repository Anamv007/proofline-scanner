"use client";

import Link from "next/link";
import { type RefObject, useMemo, useRef, useState } from "react";

import type { Finding, ScanResult } from "@/lib/types";

const severityStyles: Record<string, string> = {
  Critical: "severity-critical",
  High: "severity-high",
  Medium: "severity-medium",
  Low: "severity-low",
  Informational: "severity-info",
};

const severityRank: Record<Finding["severity"], number> = {
  Critical: 4,
  High: 3,
  Medium: 2,
  Low: 1,
  Informational: 0,
};

const confidenceRank = (confidence: string) => {
  if (confidence.toLowerCase().includes("high") || confidence.toLowerCase().includes("confirmed")) return 2;
  if (confidence.toLowerCase().includes("medium")) return 1;
  return 0;
};

const defaultSummary = {
  score: 100,
  totalFindings: 0,
  critical: 0,
  high: 0,
  medium: 0,
  low: 0,
  informational: 0,
  filesAnalyzed: 0,
  languages: [] as string[],
  dependencies: 0,
};

const sampleFinding = {
  file: "src/config.ts",
  line: 8,
  scoreBefore: 42,
  scoreAfter: 88,
  before: 'const stripeKey = "sk_live_••••••••••••80t6";',
  after: 'const stripeKey = process.env.STRIPE_SECRET_KEY;',
};

const formatBytes = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const scanWithProgress = (file: File, onProgress: (value: number) => void) =>
  new Promise<ScanResult>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", "/api/scan");
    request.responseType = "json";
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onerror = () => reject(new Error("The upload was interrupted. Check your connection and try again."));
    request.onload = () => {
      const payload = request.response as (ScanResult & { error?: string }) | null;
      if (request.status < 200 || request.status >= 300 || payload?.error) {
        reject(new Error(payload?.error || "Proofline could not complete the scan."));
        return;
      }
      onProgress(100);
      resolve(payload as ScanResult);
    };

    const formData = new FormData();
    formData.append("project", file);
    request.send(formData);
  });

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState("");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [query, setQuery] = useState("");
  const [notification, setNotification] = useState("");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [sampleFixed, setSampleFixed] = useState(false);
  const resultsRef = useRef<HTMLElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const filteredFindings = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!scanResult) return [];
    return scanResult.findings.filter((finding) => {
      if (!term) return true;
      const haystack = `${finding.title} ${finding.file} ${finding.ruleId} ${finding.category}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [query, scanResult]);

  const priorityFindings = useMemo(() => {
    if (!scanResult) return [];
    return [...scanResult.findings]
      .sort((a, b) => severityRank[b.severity] - severityRank[a.severity] || confidenceRank(b.confidence) - confidenceRank(a.confidence))
      .slice(0, 3);
  }, [scanResult]);

  const chooseFile = (file: File | undefined) => {
    setError("");
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".zip")) {
      setSelectedFile(null);
      setError("This file is not a ZIP archive. Choose a .zip project export and try again.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setSelectedFile(null);
      setError("This archive is larger than 10 MB. Remove generated files or upload a smaller project export.");
      return;
    }
    setSelectedFile(file);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFile) {
      setError("Choose a ZIP archive before scanning.");
      return;
    }
    if (!privacyAccepted) {
      setError("Confirm the analysis notice before uploading your project.");
      return;
    }

    setLoading(true);
    setUploadProgress(0);
    setError("");
    setNotification("");

    try {
      const payload = await scanWithProgress(selectedFile, setUploadProgress);
      setScanResult(payload);
      setSelectedFinding(payload.findings[0] ?? null);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setNotification("Scan complete. Your report is ready to review.");
      window.requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : "Proofline could not complete the scan.");
    } finally {
      setLoading(false);
    }
  };

  const summary = scanResult?.summary ?? defaultSummary;

  return (
    <main className="min-h-screen text-[var(--text-primary)]">
      {notification ? (
        <div className="toast" role="status" aria-live="polite">
          <span className="toast-mark" aria-hidden="true">✓</span>
          <div className="min-w-0 flex-1">
            <strong>Proofline</strong>
            <p>{notification}</p>
          </div>
          <button type="button" onClick={() => setNotification("")} aria-label="Dismiss Proofline notification">Dismiss</button>
        </div>
      ) : null}

      <div className="site-shell">
        <nav className="site-nav" aria-label="Primary navigation">
          <a href="#top" className="brand" aria-label="Proofline home">
            <span className="brand-mark" aria-hidden="true"><span /></span>
            <span>
              <strong>Proofline</strong>
              <small>Private beta</small>
            </span>
          </a>
          <div className="nav-links">
            <a href="#how-it-works">How it works</a>
            <Link href="/sample">Sample report</Link>
            <a className="nav-scan" href="#scan">Scan</a>
          </div>
        </nav>

        <section id="top" className="hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">Security review for AI-built software</p>
            <h1>Know what your generated code is actually doing.</h1>
            <p className="hero-lede">Upload a project archive. Proofline finds evidence in the code, configuration, and secrets that deserve a closer look.</p>
            <a href="#scan" className="button button-primary">Start a scan <span aria-hidden="true">↓</span></a>
            <div className="trust-line"><span>Your code is analyzed, never executed.</span><span>ZIP archives up to 10 MB</span></div>
          </div>

          <div className="hero-tools">
            <section id="scan" className="upload-panel" aria-labelledby="upload-title">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Project intake</p>
                  <h2 id="upload-title">Upload a project to scan</h2>
                </div>
                <span className="panel-index">01</span>
              </div>

              <form onSubmit={handleSubmit}>
                <div
                  className={`dropzone ${dragActive ? "dropzone-active" : ""} ${error ? "dropzone-error" : ""}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") fileInputRef.current?.click();
                  }}
                  onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }}
                  onDragOver={(event) => { event.preventDefault(); setDragActive(true); }}
                  onDragLeave={(event) => { event.preventDefault(); setDragActive(false); }}
                  onDrop={(event) => { event.preventDefault(); setDragActive(false); chooseFile(event.dataTransfer.files[0]); }}
                >
                  <input ref={fileInputRef} type="file" accept=".zip" className="sr-only" onChange={(event) => chooseFile(event.target.files?.[0])} />
                  <span className="upload-symbol" aria-hidden="true">↑</span>
                  {selectedFile ? (
                    <>
                      <strong>{selectedFile.name}</strong>
                      <span>{formatBytes(selectedFile.size)} · Ready to scan</span>
                    </>
                  ) : (
                    <>
                      <strong>Drop your project ZIP here</strong>
                      <span>or choose a file from your computer</span>
                    </>
                  )}
                </div>

                <label className="privacy-check">
                  <input type="checkbox" checked={privacyAccepted} onChange={(event) => setPrivacyAccepted(event.target.checked)} />
                  <span>I understand this beta analyzes source text and does not execute my code.</span>
                </label>

                {loading ? (
                  <div className="progress-block" aria-live="polite">
                    <div className="progress-meta"><span>Uploading project</span><span>{uploadProgress}%</span></div>
                    <div className="progress-track"><span style={{ width: `${Math.max(uploadProgress, 4)}%` }} /></div>
                    <p>Analysis begins after the archive reaches Proofline.</p>
                  </div>
                ) : null}

                {error ? <div className="inline-error" role="alert"><strong>Could not start the scan.</strong><span>{error}</span></div> : null}

                <button type="submit" className="button button-primary button-full" disabled={loading || !selectedFile || !privacyAccepted}>
                  {loading ? "Analyzing project..." : "Upload and scan"}
                </button>
              </form>
            </section>

            <SampleFinding fixed={sampleFixed} onToggle={() => setSampleFixed((value) => !value)} />
          </div>
        </section>

        <section id="how-it-works" className="workflow-section" aria-labelledby="workflow-title">
          <div className="section-heading">
            <p className="eyebrow">A clear path from code to action</p>
            <h2 id="workflow-title">Review the evidence. Fix what matters. Rescan.</h2>
          </div>
          <div className="workflow-rail">
            {[
              ["01", "Upload", "Bring a ZIP export of the project you want to review."],
              ["02", "Extract", "Project files are read as text. Generated folders are skipped."],
              ["03", "Analyze", "Deterministic rules inspect code, config, and secret-like values."],
              ["04", "Review", "Open each finding to see evidence, impact, and a fix path."],
              ["05", "Rescan", "Upload the changed project and compare what the rules report."],
            ].map(([number, title, description]) => (
              <div className="workflow-step" key={number}>
                <span className="workflow-number">{number}</span>
                <div><h3>{title}</h3><p>{description}</p></div>
              </div>
            ))}
          </div>
        </section>

        {scanResult ? (
          <ResultsDashboard
            result={scanResult}
            resultsRef={resultsRef}
            summary={summary}
            findings={filteredFindings}
            priorityFindings={priorityFindings}
            selectedFinding={selectedFinding}
            query={query}
            onQueryChange={setQuery}
            onSelect={setSelectedFinding}
          />
        ) : (
          <EmptyReportState />
        )}
      </div>
    </main>
  );
}

function SampleFinding({ fixed, onToggle }: { fixed: boolean; onToggle: () => void }) {
  return (
    <section className="sample-panel" aria-labelledby="sample-title">
      <div className="sample-label"><span>Sample — not from your project</span><span>Interactive preview</span></div>
      <div className="sample-heading">
        <div><h2 id="sample-title">Potential hardcoded secret</h2><p>Credential-like value in a source file</p></div>
        <span className="confidence-badge">High confidence</span>
      </div>
      <div className="code-window" aria-label="Sample code finding">
        <div className="code-toolbar"><span>src/config.ts:{sampleFinding.line}</span><span>{fixed ? "After fix" : "Before fix"}</span></div>
        <div className="code-line"><span className="line-number">07</span><span>import config from &quot;./config&quot;;</span></div>
        <div className={`code-line code-line-highlight ${fixed ? "code-line-fixed" : ""}`}><span className="line-number">08</span><span>{fixed ? sampleFinding.after : sampleFinding.before}</span></div>
        <div className="code-line"><span className="line-number">09</span><span>export default config;</span></div>
      </div>
      <div className="sample-footer">
        <span>{fixed ? "The secret is now loaded at runtime." : "This value should not live in the source tree."}</span>
        <button type="button" className="toggle-button" onClick={onToggle} aria-pressed={fixed}>{fixed ? "View before fix" : "View after fix"}</button>
      </div>
      <div className="sample-score"><span>Sample score</span><strong>{fixed ? sampleFinding.scoreAfter : sampleFinding.scoreBefore}<small>/100</small></strong></div>
    </section>
  );
}

type ResultsProps = {
  result: ScanResult;
  resultsRef: RefObject<HTMLElement | null>;
  summary: typeof defaultSummary;
  findings: Finding[];
  priorityFindings: Finding[];
  selectedFinding: Finding | null;
  query: string;
  onQueryChange: (value: string) => void;
  onSelect: (finding: Finding) => void;
};

function ResultsDashboard({ result, resultsRef, summary, findings, priorityFindings, selectedFinding, query, onQueryChange, onSelect }: ResultsProps) {
  return (
    <section ref={resultsRef} id="report" tabIndex={-1} className="results-section" aria-labelledby="results-title">
      <div className="results-header">
        <div><p className="eyebrow">Live scan report</p><h2 id="results-title">{result.projectName}</h2><p className="muted-copy">Generated from your uploaded project on {new Date(result.scannedAt).toLocaleString()}.</p></div>
        <div className="score-block"><span>Risk score</span><strong>{summary.score}<small>/100</small></strong><p>Based on detected rule matches</p></div>
      </div>

      <div className="summary-grid">
        {[["Findings", summary.totalFindings], ["Critical", summary.critical], ["High", summary.high], ["Medium", summary.medium], ["Files", summary.filesAnalyzed]].map(([label, value]) => <div className="summary-cell" key={label}><span>{label}</span><strong>{value}</strong></div>)}
      </div>

      {priorityFindings.length > 0 ? (
        <div className="priority-section">
          <div className="section-heading compact"><p className="eyebrow">Start here</p><h3>What to fix first</h3><p>Prioritized by severity, then confidence. This is a view of findings from this scan.</p></div>
          <div className="priority-grid">
            {priorityFindings.map((finding) => <button type="button" className="priority-card" key={finding.id} onClick={() => onSelect(finding)}><span className={`severity-pill ${severityStyles[finding.severity]}`}>{finding.severity}</span><strong>{finding.title}</strong><span className="mono">{finding.file}:{finding.line}</span><span>{finding.confidence}</span></button>)}
          </div>
        </div>
      ) : (
        <div className="honest-success"><strong>No issues detected by the current rules.</strong><span>This result is limited to the checks Proofline currently runs; it is not a security guarantee.</span></div>
      )}

      <div className="findings-layout">
        <div className="findings-panel">
          <div className="panel-heading"><div><p className="eyebrow">Evidence list</p><h3>Findings from this scan</h3></div><label className="search-field"><span className="sr-only">Search findings</span><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search findings" /></label></div>
          <div className="table-scroll"><table><thead><tr><th>Severity</th><th>Finding</th><th>Location</th><th>Confidence</th></tr></thead><tbody>{findings.length > 0 ? findings.map((finding) => <tr key={finding.id} className={selectedFinding?.id === finding.id ? "row-selected" : ""} onClick={() => onSelect(finding)}><td><span className={`severity-pill ${severityStyles[finding.severity]}`}>{finding.severity}</span></td><td><strong>{finding.title}</strong><span>{finding.category}</span></td><td className="mono">{finding.file}:{finding.line}</td><td>{finding.confidence}</td></tr>) : <tr><td colSpan={4} className="table-empty">No findings match &ldquo;{query}&rdquo;.</td></tr>}</tbody></table></div>
        </div>
        <FindingDetail finding={selectedFinding} />
      </div>
    </section>
  );
}

function FindingDetail({ finding }: { finding: Finding | null }) {
  if (!finding) return <aside className="detail-panel detail-empty">Select a finding to inspect its evidence and fix guidance.</aside>;
  return <aside className="detail-panel"><div className="detail-top"><div><p className="eyebrow">Finding detail</p><h3>{finding.title}</h3></div><span className={`severity-pill ${severityStyles[finding.severity]}`}>{finding.severity}</span></div><div className="detail-meta mono">{finding.file}:{finding.line} · {finding.ruleId}</div><div className="evidence-block"><span>Evidence</span><pre><code><b>{String(finding.line).padStart(2, "0")}</b>{finding.maskedEvidence}</code></pre></div><dl className="detail-copy"><div><dt>Why it matters</dt><dd>{finding.impact}</dd></div><div><dt>How to fix</dt><dd>{finding.remediation}</dd></div><div><dt>How to verify</dt><dd>{finding.verification}</dd></div></dl><div className="reference-list"><span>References</span>{finding.references.map((reference) => <a href={reference} target="_blank" rel="noreferrer" key={reference}>{reference.replace(/^https?:\/\//, "")}</a>)}</div></aside>;
}

function EmptyReportState() {
  return <section className="empty-report" aria-labelledby="empty-report-title"><div><p className="eyebrow">Your report will contain</p><h2 id="empty-report-title">Evidence you can act on.</h2><p>Run a scan to replace this overview with findings from your own project. No sample data is mixed into live results.</p></div><div className="report-anatomy"><div><span className="anatomy-icon">01</span><strong>File and line</strong><span>Exact location to inspect</span></div><div><span className="anatomy-icon">02</span><strong>Evidence</strong><span>Masked code or value</span></div><div><span className="anatomy-icon">03</span><strong>Confidence</strong><span>How strongly the rule matches</span></div><div><span className="anatomy-icon">04</span><strong>Fix and verify</strong><span>Guidance for the next change</span></div></div></section>;
}
