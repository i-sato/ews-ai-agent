// Menentukan tag Playwright yang perlu dijalankan dari file yang berubah (spesifikasi §12.7).
// Output untuk $GITHUB_OUTPUT: `grep=<regex>`; kosong berarti E2E dilewati.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const map = JSON.parse(readFileSync(new URL("../tests/e2e/scope-map.json", import.meta.url)));

export function globToRegExp(glob) {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  const pattern = escaped
    .replace(/\*\*\/?/g, "<<ANY>>")
    .replace(/\*/g, "[^/]*")
    .replace(/<<ANY>>/g, ".*");
  return new RegExp(`^${pattern}$`);
}

const matchesAny = (file, globs) => globs.some((g) => globToRegExp(g).test(file));

export function affectedGrep(files, { full = false } = {}) {
  if (full || files.some((f) => matchesAny(f, map.full))) return "@";
  if (!files.some((f) => matchesAny(f, map.app))) return "";
  const tags = Object.entries(map.tags)
    .filter(([, globs]) => files.some((f) => matchesAny(f, globs)))
    .map(([tag]) => tag);
  return ["@smoke", ...tags].join("|");
}

function changedFiles(base) {
  const out = execFileSync("git", ["diff", "--name-only", `${base}...HEAD`], { encoding: "utf8" });
  return out.split("\n").filter(Boolean);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const full = process.env.FULL === "true";
  const base = process.env.BASE_SHA;
  const files = full || !base ? [] : changedFiles(base);
  const grep = affectedGrep(files, { full: full || !base });
  process.stdout.write(`grep=${grep}\n`);
}
