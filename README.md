# Proofline

Proofline is a security review tool for AI-assisted applications. Upload a project ZIP, run deterministic static checks against the extracted source, and inspect evidence-backed findings with remediation guidance.

**Live demo:** [scanner-v1.vercel.app](https://scanner-v1.vercel.app)

> Proofline is an early beta and a static pattern scanner. It does not execute uploaded code, and a clean report is not a security guarantee.

## What it does

- Accepts project ZIP archives up to 10 MB.
- Reads supported source and configuration files as text without executing them.
- Reports findings with severity, confidence, file, line, evidence, impact, and remediation.
- Calculates a bounded risk score and highlights the highest-priority findings.
- Keeps the demonstration report at `/sample` separate from uploaded-project results.

## Detection coverage

- Hardcoded secret-like values and public secret environment variables
- Dynamic code execution and command execution
- Unsafe DOM sinks
- SQL injection, path traversal, and SSRF patterns
- Wildcard CORS and cookie security flags
- Verbose debug and source-map configuration

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), create a ZIP containing the project files you want to review, and upload it. Supported file types include JavaScript, TypeScript, Python, JSON, YAML, Markdown, and environment files. Dependency directories and build output are skipped.

## Verify changes

```bash
npm test
npm run lint
npm run build
```

## Project structure

```text
app/              Next.js pages and the scan API route
lib/              Scanner rules and shared TypeScript types
tests/             Node test suite for scanner behavior
public/            Static assets
```

## Deployment

The app is configured for Next.js and deploys directly to Vercel:

```bash
npx vercel --prod
```

For automatic deployments, import the repository into Vercel and enable deployments from the main branch.

## Data and privacy

Uploaded archives are processed by the scan API and are not executed. The beta writes the ten most recent scan results to `data/scan-history.json` locally. That generated file is ignored by Git and should not be committed. Production deployments need a persistent database or storage service if scan history must survive serverless instances.

## License

No license has been selected yet. Add one before accepting external contributions or allowing reuse of the code.
