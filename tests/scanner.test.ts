import test from "node:test";
import assert from "node:assert/strict";

import { analyzeProjectFiles, summarizeFindings } from "../lib/scanner";

test("detects exposed secrets and dangerous code patterns", () => {
  const findings = analyzeProjectFiles([
    {
      path: "src/config.ts",
      content: `
        const stripeKey = "sk_live_1234567890abcdef";
        const handler = () => eval(userInput);
      `,
    },
  ]);

  const secretFinding = findings.find((finding) => finding.ruleId === "SECRET-001");
  const evalFinding = findings.find((finding) => finding.ruleId === "CODE-001");

  assert.ok(secretFinding, "Expected a secret detection finding");
  assert.ok(evalFinding, "Expected a dangerous eval detection finding");
});

test("does not flag a clean project as vulnerable", () => {
  const findings = analyzeProjectFiles([
    {
      path: "src/app.ts",
      content: `
        export function safeName(name: string) {
          return name.trim();
        }
      `,
    },
  ]);

  assert.equal(
    findings.some((finding) => finding.ruleId === "SECRET-001" || finding.ruleId === "CODE-001"),
    false,
  );
});

test("detects evidence across the main static rule categories", () => {
  const findings = analyzeProjectFiles([
    {
      path: "src/api.ts",
      content: `
        const html = element.innerHTML;
        execSync(userCommand);
        db.query("SELECT * FROM users WHERE id = " + req.query.id);
        readFile(req.query.path);
        fetch(targetUrl);
        res.setHeader("Access-Control-Allow-Origin", "*");
      `,
    },
  ]);

  assert.deepEqual(
    findings.map((finding) => finding.ruleId),
    ["CLIENT-001", "CMD-001", "INJECT-001", "PATH-001", "SSRF-001", "CORS-001"],
  );
  assert.ok(findings.every((finding) => finding.evidence.length > 0 && finding.file === "src/api.ts"));
});

test("summarizes findings into a bounded security score", () => {
  const findings = analyzeProjectFiles([
    {
      path: "src/config.ts",
      content: `const apiKey = "sk_live_1234567890abcdef";\nconst run = () => eval(input);`,
    },
  ]);

  const summary = summarizeFindings(findings);

  assert.equal(summary.totalFindings, 2);
  assert.equal(summary.high, 2);
  assert.equal(summary.score, 64);
  assert.ok(summary.score >= 0 && summary.score <= 100);
});
