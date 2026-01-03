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

describe("env repo proof", () => {
    it("disallows direct process.env access outside lib/env.ts", () => {
        const files = walk(ROOT).filter((f) => {
            const rel = path.relative(ROOT, f).replace(/\\/g, "/");
            return (
                (rel.endsWith(".ts") || rel.endsWith(".tsx")) &&
                !rel.endsWith(".test.ts") &&
                rel !== "lib/env.ts"
            );
        });


        const offenders: string[] = [];

        for (const file of files) {
            const content = fs.readFileSync(file, "utf8");
            if (content.includes("process.env")) {
                offenders.push(path.relative(ROOT, file));
            }
        }

        expect(offenders).toEqual([]);
    });
});
