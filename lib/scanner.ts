import crypto from "node:crypto";

import type { Finding, ProjectFile, ScanSummary } from "./types";

const severityWeight: Record<Finding["severity"], number> = {
  Critical: 30,
  High: 18,
  Medium: 8,
  Low: 3,
  Informational: 1,
};

const maskValue = (value: string): string => {
  if (!value || value.length <= 6) {
    return value;
  }

  const trimmed = value.trim().replace(/^['\"]|['\"]$/g, "");
  if (trimmed.length <= 6) {
    return `${trimmed.slice(0, 2)}••••${trimmed.slice(-2)}`;
  }

  return `${trimmed.slice(0, 4)}••••••••${trimmed.slice(-4)}`;
};

const makeId = (prefix: string, text: string) =>
  `${prefix}-${crypto.createHash("sha1").update(`${prefix}:${text}`).digest("hex").slice(0, 10)}`;

const buildFinding = ({
  ruleId,
  title,
  severity,
  category,
  confidence,
  file,
  line,
  column,
  evidence,
  description,
  impact,
  remediation,
  verification,
  references,
}: {
  ruleId: string;
  title: string;
  severity: Finding["severity"];
  category: string;
  confidence: string;
  file: string;
  line: number;
  column: number;
  evidence: string;
  description: string;
  impact: string;
  remediation: string;
  verification: string;
  references: string[];
}): Finding => {
  const unique = `${file}:${line}:${ruleId}:${evidence}`;

  return {
    id: makeId("finding", unique),
    ruleId,
    title,
    severity,
    category,
    confidence,
    file,
    line,
    column,
    evidence,
    maskedEvidence: maskValue(evidence),
    description,
    impact,
    remediation,
    verification,
    references,
    status: "Open",
  };
};

const inferLanguage = (path: string): string => {
  const normalized = path.toLowerCase();
  if (normalized.endsWith(".ts") || normalized.endsWith(".tsx")) return "TypeScript";
  if (normalized.endsWith(".js") || normalized.endsWith(".jsx")) return "JavaScript";
  if (normalized.endsWith(".py")) return "Python";
  if (normalized.endsWith(".json")) return "JSON";
  if (normalized.endsWith(".yaml") || normalized.endsWith(".yml")) return "YAML";
  if (normalized.includes(".env")) return "Environment";
  return "Other";
};

export const summarizeFindings = (findings: Finding[]): ScanSummary => {
  const counts = {
    Critical: 0,
    High: 0,
    Medium: 0,
    Low: 0,
    Informational: 0,
  };

  for (const finding of findings) {
    counts[finding.severity] += 1;
  }

  const score = Math.max(
    0,
    Math.min(
      100,
      100 - findings.reduce((total, finding) => total + severityWeight[finding.severity], 0),
    ),
  );

  const languages = [...new Set(findings.map((finding) => inferLanguage(finding.file)))];

  return {
    totalFindings: findings.length,
    score,
    critical: counts.Critical,
    high: counts.High,
    medium: counts.Medium,
    low: counts.Low,
    informational: counts.Informational,
    filesAnalyzed: new Set(findings.map((finding) => finding.file)).size || 0,
    languages: languages.filter((language) => language !== "Other"),
    dependencies: 0,
  };
};

export const analyzeProjectFiles = (files: ProjectFile[]): Finding[] => {
  const findings: Finding[] = [];

  for (const file of files) {
    const lines = file.content.split(/\r?\n/);
    const fileLower = file.path.toLowerCase();

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const lineNumber = index + 1;

      const secretMatch = line.match(
          /(NEXT_PUBLIC_[A-Z0-9_]*(?:SECRET|TOKEN|KEY|PASSWORD)|VITE_[A-Z0-9_]*(?:SECRET|TOKEN|KEY|PASSWORD)|[A-Za-z_][A-Za-z0-9_]*(?:secret|token|key|password|url)[\s:=]+['"]?([A-Za-z0-9._~+/=:-]{12,})['"]?)/i,
      );

      if (secretMatch) {
        const value = secretMatch[2] || secretMatch[1] || line;
        findings.push(
          buildFinding({
            ruleId: "SECRET-001",
            title: "Potential hardcoded secret detected",
            severity: "High",
            category: "Secrets",
            confidence: "High Confidence",
            file: file.path,
            line: lineNumber,
            column: line.indexOf(value) + 1,
            evidence: value,
            description:
              "A credential-like value was found in source code or environment configuration and may be exposed to the client or repository.",
            impact:
              "Exposed secrets can enable unauthorized access to third-party services, internal APIs, or database infrastructure.",
            remediation:
              "Move the value to a secret manager or environment variable outside the source tree, then reference it through secure runtime configuration.",
            verification:
              "Confirm the secret is removed from the codebase and replaced with a managed runtime secret at deployment time.",
            references: [
              "https://owasp.org/www-project-top-ten/",
              "https://www.nist.gov/itl/applied-cybersecurity",
            ],
          }),
        );
      }

      if (/\beval\s*\(/i.test(line) || /\bFunction\s*\(/i.test(line)) {
        findings.push(
          buildFinding({
            ruleId: "CODE-001",
            title: "Dynamic code execution pattern",
            severity: "High",
            category: "Code Execution",
            confidence: "Confirmed Pattern",
            file: file.path,
            line: lineNumber,
            column: line.search(/\beval\s*\(|\bFunction\s*\(/i) + 1,
            evidence: line.trim(),
            description:
              "The code constructs or executes code dynamically, which can allow script injection and command execution if untrusted input is involved.",
            impact:
              "Attackers may achieve arbitrary code execution when untrusted values reach the evaluated expression.",
            remediation:
              "Replace dynamic evaluation with explicit logic, safer parsing APIs, or trusted static operations. Never evaluate raw user-controlled input.",
            verification:
              "Verify the dangerous call is removed and replaced with a safe, deterministic implementation path.",
            references: ["https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/eval"],
          }),
        );
      }

      if (/\binnerHTML\b|\bouterHTML\b/i.test(line)) {
        findings.push(
          buildFinding({
            ruleId: "CLIENT-001",
            title: "Unsafe DOM HTML assignment",
            severity: "Medium",
            category: "DOM Injection",
            confidence: "Confirmed Pattern",
            file: file.path,
            line: lineNumber,
            column: line.search(/\binnerHTML\b|\bouterHTML\b/i) + 1,
            evidence: line.trim(),
            description:
              "HTML is inserted into a DOM sink through a method that can allow unsafe markup or script execution.",
            impact:
              "A malicious payload may execute in the browser or hijack application content if user-controlled data reaches the DOM sink.",
            remediation:
              "Use textContent, sanitized templates, or a trusted HTML sanitizer instead of assigning raw HTML.",
            verification:
              "Confirm the code no longer writes user-controlled HTML directly into the page and that input is sanitized before rendering.",
            references: ["https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html"],
          }),
        );
      }

      if (/\bexecSync\b|\bspawn\s*\(|\bexec\s*\(/i.test(line) && /child_process|execSync|exec\(/i.test(line)) {
        findings.push(
          buildFinding({
            ruleId: "CMD-001",
            title: "Command execution pattern detected",
            severity: "High",
            category: "Command Execution",
            confidence: "Confirmed Pattern",
            file: file.path,
            line: lineNumber,
            column: line.search(/\bexecSync\b|\bspawn\s*\(|\bexec\s*\(/i) + 1,
            evidence: line.trim(),
            description:
              "The application appears to invoke a shell command or process execution routine from source code.",
            impact:
              "If user-controlled input reaches the command string, an attacker may trigger arbitrary system commands.",
            remediation:
              "Avoid shell execution when possible and validate arguments strictly. Use parameterized APIs and a minimal set of allowed commands.",
            verification:
              "Review command construction for input sanitization and confirm no untrusted strings are concatenated into the shell invocation.",
            references: ["https://nodejs.org/api/child_process.html"],
          }),
        );
      }

      if (
        /SELECT\s+.*\+.*(req|query|params|body|user|input)|SELECT\s+.*\$\{.*(req|query|params|body|user|input)/i.test(
          line,
        ) || /INSERT\s+.*\+.*(req|query|params|body|user|input)|UPDATE\s+.*\+.*(req|query|params|body|user|input)/i.test(line)
      ) {
        findings.push(
          buildFinding({
            ruleId: "INJECT-001",
            title: "Potential SQL injection pattern",
            severity: "High",
            category: "Injection",
            confidence: "Medium Confidence",
            file: file.path,
            line: lineNumber,
            column: line.search(/SELECT|INSERT|UPDATE/i) + 1,
            evidence: line.trim(),
            description:
              "A database query appears to be assembled from user-controlled or request-derived data without a parameterized query mechanism.",
            impact:
              "Attackers may alter query semantics or exfiltrate records if the request input is not properly sanitized and bound.",
            remediation:
              "Use prepared statements, parameterized queries, and strict validation before embedding values into database queries.",
            verification:
              "Inspect the query builder and confirm every dynamic value is passed as a bound parameter instead of raw string concatenation.",
            references: ["https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html"],
          }),
        );
      }

      if (
        /(?:fs\.|readFile|writeFile|open|createReadStream|createWriteStream)\s*\(/i.test(line) &&
        /(?:\.\.[\\/]|\.{2,}|req\.|params|query|body|user|input|path)/i.test(line)
      ) {
        findings.push(
          buildFinding({
            ruleId: "PATH-001",
            title: "Potential path traversal or unsafe file access",
            severity: "Medium",
            category: "Path Traversal",
            confidence: "Medium Confidence",
            file: file.path,
            line: lineNumber,
            column: line.search(/(?:fs\.|readFile|writeFile|open|createReadStream|createWriteStream)\s*\(/i) + 1,
            evidence: line.trim(),
            description:
              "A filesystem operation appears to use request data or path segments without enforcing expected boundaries.",
            impact:
              "An attacker may read or write files outside the intended application directory when path validation is weak.",
            remediation:
              "Normalize and validate paths, restrict access to approved directories, and reject traversal patterns before filesystem operations.",
            verification:
              "Confirm path inputs are normalized and sanitized against an allowlist before reaching the file system.",
            references: ["https://owasp.org/www-community/attacks/Path_Traversal"],
          }),
        );
      }

      if (
        /\bfetch\s*\(|axios\.(get|post|put|delete|request)\s*\(|request\s*\(/i.test(line) &&
        /(req\.|query|params|body|user|input|url|target)/i.test(line)
      ) {
        findings.push(
          buildFinding({
            ruleId: "SSRF-001",
            title: "Potential server-side request forgery pattern",
            severity: "Medium",
            category: "Server Security",
            confidence: "Medium Confidence",
            file: file.path,
            line: lineNumber,
            column: line.search(/\bfetch\s*\(|axios\.|request\s*\(/i) + 1,
            evidence: line.trim(),
            description:
              "A server-side outbound HTTP call appears to accept a URL from request data, which can enable SSRF when untrusted values are supplied.",
            impact:
              "Attackers may force the server to connect to internal services, metadata endpoints, or restricted infrastructure.",
            remediation:
              "Restrict allowed hosts, enforce URL validation, and avoid passing raw user-controlled URLs to outbound requests.",
            verification:
              "Review the outbound request target and ensure only approved protocols, hosts, and ports are permitted.",
            references: ["https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html"],
          }),
        );
      }

      if (fileLower.includes(".env") || fileLower.includes("env.")) {
        if (/NEXT_PUBLIC_[A-Z0-9_]*(?:SECRET|TOKEN|KEY|PASSWORD)|VITE_[A-Z0-9_]*(?:SECRET|TOKEN|KEY|PASSWORD)/i.test(line)) {
          findings.push(
            buildFinding({
              ruleId: "SECRET-002",
              title: "Public environment variable appears to contain a secret",
              severity: "High",
              category: "Secrets",
              confidence: "High Confidence",
              file: file.path,
              line: lineNumber,
              column: line.search(/NEXT_PUBLIC_|VITE_/i) + 1,
              evidence: line.trim(),
              description:
                "A public client-side environment variable name suggests it may contain a secret or sensitive credential that is being exposed to frontend code.",
              impact:
                "Credentials exposed to browser bundles can be collected by any user visiting the site and abused on external services.",
              remediation:
                "Rename the variable to a server-only name and ensure the value never reaches the client bundle.",
              verification:
                "Check that the secret is only loaded server-side and is not referenced from frontend code or public build outputs.",
              references: ["https://nextjs.org/docs/app/building-your-application/configuring/environment-variables"],
            }),
          );
        }
      }

      if (
        /Access-Control-Allow-Origin\s*:\s*\*|Access-Control-Allow-Origin["']?\s*,\s*["']\*["']|origin\s*:\s*["']\*["']/i.test(
          line,
        )
      ) {
        findings.push(
          buildFinding({
            ruleId: "CORS-001",
            title: "Overly permissive CORS configuration",
            severity: "Medium",
            category: "Configuration",
            confidence: "Confirmed Pattern",
            file: file.path,
            line: lineNumber,
            column: line.search(/Access-Control-Allow-Origin|origin/i) + 1,
            evidence: line.trim(),
            description:
              "The application permits cross-origin requests from any origin, which can increase exposure for authenticated endpoints and sensitive APIs.",
            impact:
              "Attackers may abuse the API from other domains if the endpoint is otherwise reachable and auth is weak or absent.",
            remediation:
              "Restrict CORS origins to trusted domains and avoid using wildcard values unless the endpoint is intentionally public and low risk.",
            verification:
              "Check the allowed origins list and verify that only expected deployment domains are accepted.",
            references: ["https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS"],
          }),
        );
      }

      if (/\bcookie\s*\(/i.test(line) && !/httpOnly|secure|sameSite/i.test(line)) {
        findings.push(
          buildFinding({
            ruleId: "COOKIE-001",
            title: "Cookie configuration may be missing secure flags",
            severity: "Low",
            category: "Authentication",
            confidence: "Medium Confidence",
            file: file.path,
            line: lineNumber,
            column: line.search(/\bcookie\s*\(/i) + 1,
            evidence: line.trim(),
            description:
              "A cookie is set without any observable HttpOnly, Secure, or SameSite protections in the same statement.",
            impact:
              "Session cookies may be more exposed to browser-side scripts or cross-site requests.",
            remediation:
              "Set HttpOnly, Secure, and SameSite to appropriate values, and review whether the cookie should be restricted by domain or path.",
            verification:
              "Confirm the cookie creation logic includes the minimum recommended protections for the application lifecycle.",
            references: ["https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie"],
          }),
        );
      }

      if (fileLower.includes("next.config") || fileLower.includes("vite.config") || fileLower.includes("webpack")) {
        if (/\bdevtool\s*:\s*true|sourceMap\s*:\s*true|debug\s*:\s*true/i.test(line)) {
          findings.push(
            buildFinding({
              ruleId: "CONFIG-001",
              title: "Potentially verbose debugging configuration enabled",
              severity: "Low",
              category: "Configuration",
              confidence: "Medium Confidence",
              file: file.path,
              line: lineNumber,
              column: line.search(/devtool|sourceMap|debug/i) + 1,
              evidence: line.trim(),
              description:
                "A debug or source map setting may expose extra implementation details in a production build.",
              impact:
                "Verbose configuration can leak internal paths, stack traces, or debugging information to end users or attackers.",
              remediation:
                "Disable debug configurations in production and tighten build-time instrumentation for release environments.",
              verification:
                "Confirm the production settings do not expose developer debugging information in deployment bundles.",
              references: ["https://nextjs.org/docs/app/api-reference/config/next-config-js"],
            }),
          );
        }
      }
    }
  }

  return findings;
};
