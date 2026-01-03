import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const ROOT = process.cwd();

const EXCLUDE_DIRS = [
  "node_modules",
  ".next",
  "coverage",
  "dist",
  ".git",
];

function walk(dir: string, files: string[] = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (EXCLUDE_DIRS.includes(entry.name)) continue;
      walk(fullPath, files);
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

function rel(p: string) {
  return path.relative(ROOT, p).replace(/\\/g, "/");
}

describe("TLS repo proof", () => {
  it("disallows rejectUnauthorized: false outside test files", () => {
    const files = walk(ROOT).filter((f) => {
      const r = rel(f);
      return (
        (r.endsWith(".ts") ||
          r.endsWith(".tsx") ||
          r.endsWith(".js") ||
          r.endsWith(".mjs") ||
          r.endsWith(".cjs")) &&
        !r.endsWith(".test.ts")
      );
    });

    const offenders: string[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, "utf8");
      if (/rejectUnauthorized\s*:\s*false/.test(content)) {
        offenders.push(rel(file));
      }
    }

    expect(offenders).toEqual([]);
  });
});
