import { promises as fs } from "node:fs";
import path from "node:path";

import JSZip from "jszip";
import { NextResponse } from "next/server";

import { analyzeProjectFiles, summarizeFindings } from "@/lib/scanner";
import type { ScanResult } from "@/lib/types";

const ignored = [
  "/node_modules/",
  "/.next/",
  "/dist/",
  "/build/",
  "/coverage/",
  "/.git/",
  "/.venv/",
  "/vendor/",
  "/.cache/",
];

const supportedExtensions = [
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".json",
  ".yaml",
  ".yml",
  ".env",
  ".example",
  ".py",
  ".md",
];

const maxUploadBytes = 10 * 1024 * 1024;
const maxProjectFiles = 1000;

const isSafeArchivePath = (entryName: string) => {
  const normalized = entryName.replace(/\\/g, "/");
  return !normalized.startsWith("/") && !normalized.split("/").includes("..");
};

const writeHistory = async (scan: ScanResult) => {
  const dataDir = path.join(process.cwd(), "data");
  const historyPath = path.join(dataDir, "scan-history.json");

  await fs.mkdir(dataDir, { recursive: true });
  const existing = await fs.readFile(historyPath, "utf-8").catch(() => "[]");
  const history = JSON.parse(existing) as ScanResult[];
  history.unshift(scan);

  await fs.writeFile(historyPath, JSON.stringify(history.slice(0, 10), null, 2), "utf-8");
};

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const uploaded = formData.get("project");

    if (!(uploaded instanceof File)) {
      return NextResponse.json({ error: "Please upload a ZIP archive." }, { status: 400 });
    }

    if (!uploaded.name.toLowerCase().endsWith(".zip")) {
      return NextResponse.json({ error: "Only ZIP uploads are supported for the beta scanner." }, { status: 400 });
    }

    if (uploaded.size > maxUploadBytes) {
      return NextResponse.json({ error: "The ZIP archive must be smaller than 10 MB." }, { status: 413 });
    }

    const zipBytes = Buffer.from(await uploaded.arrayBuffer());
    const zip = await JSZip.loadAsync(zipBytes);
    const files: Array<{ path: string; content: string }> = [];

    const entries = Object.entries(zip.files);

    if (entries.length > maxProjectFiles) {
      return NextResponse.json({ error: "The uploaded project contains too many archive entries for the beta scanner." }, { status: 413 });
    }

    for (const [entryName, entry] of entries) {
      if (entry.dir) continue;
      if (!isSafeArchivePath(entryName)) continue;
      if (ignored.some((prefix) => entryName.includes(prefix))) continue;

      const normalized = entryName.replace(/\\/g, "/");
      const extension = path.extname(normalized).toLowerCase();

      if (!supportedExtensions.includes(extension) && !normalized.toLowerCase().includes(".env")) {
        continue;
      }

      const text = await entry.async("string");
      files.push({ path: normalized, content: text });
    }

    if (!files.length) {
      return NextResponse.json({ error: "No supported project files were found in the uploaded archive." }, { status: 422 });
    }

    const findings = analyzeProjectFiles(files);
    const summary = summarizeFindings(findings);
    const scanResult: ScanResult = {
      id: `scan-${Date.now()}`,
      projectName: uploaded.name.replace(/\.zip$/i, "") || "uploaded-project",
      scannedAt: new Date().toISOString(),
      summary: {
        ...summary,
        filesAnalyzed: files.length,
        dependencies: files.filter((file) => file.path.toLowerCase().includes("package.json") || file.path.toLowerCase().includes("requirements.txt")).length,
      },
      findings,
    };

    await writeHistory(scanResult);

    return NextResponse.json(scanResult);
  } catch (error) {
    return NextResponse.json(
      {
        error: "The archive could not be processed. Please ensure it is a valid ZIP and not corrupted.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
