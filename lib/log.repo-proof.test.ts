import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const ROOT = process.cwd();

const EXCLUDE_DIRS = ["node_modules", ".next", "coverage", "dist", ".git"];

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

function relPath(p: string) {
    return path.relative(ROOT, p).replace(/\\/g, "/");
}

describe("log repo proof", () => {
    it("disallows likely-secret logging patterns outside tests", () => {
        const files = walk(ROOT).filter((f) => {
            const rel = relPath(f);
            return (
                (rel.endsWith(".ts") || rel.endsWith(".tsx")) &&
                !rel.endsWith(".test.ts") &&
                // allow the logger itself
                rel !== "lib/log.ts"
            );
        });

        const offenders: string[] = [];

        // Things that, if present in logged strings/objects, are almost always sensitive.
        // We keep this list small and high-signal to avoid false positives.
        const SECRET_MARKERS = [
            "authorization",
            "set-cookie",
            "cookie",
            "invitetoken",
            "access_token",
            "refresh_token",
            "id_token",
            "client_secret",
            "auth_secret",
            "database_url",
            "apikey",
            "api_key",
            "privatekey",
            "private_key",
            "password",
            "passwordhash",
            "sessiontoken",
            "session_token",
        ];

        // Flag only when a logging call itself includes a suspicious key
        // (not merely when the file processes tokens).
        const LOG_LINE_RE =
            /\b(console\.(log|info|warn|error)|log\.(debug|info|warn|error))\s*\(([^)]*)\)/g;

        const SECRET_RE = new RegExp(
            `\\b(${SECRET_MARKERS.join("|")})\\b`,
            "i",
        );

        for (const file of files) {
            const content = fs.readFileSync(file, "utf8");

            let match: RegExpExecArray | null;
            while ((match = LOG_LINE_RE.exec(content))) {
                const logArgs = match[3];

                if (SECRET_RE.test(logArgs)) {
                    offenders.push(relPath(file));
                    break;
                }
            }
        }


        expect(offenders).toEqual([]);
    });
});
