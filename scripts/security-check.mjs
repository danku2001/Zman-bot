import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const forbiddenTrackedFiles = [".env", "apps/web/.env", "apps/bot/.env"];
const trackedFiles = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" })
  .split("\n")
  .filter(Boolean);

function hasRealSecret(rel, text) {
  if (/\b\d{8,12}:AA[A-Za-z0-9_-]{20,}\b/u.test(text)) return true;
  if (/(?:postgres|postgresql):\/\/[^ \n]+:[^ \n]+@/u.test(text)) return true;
  if (rel.startsWith("apps/web/") && /NEXT_PUBLIC_API_SECRET/u.test(text)) return true;
  return false;
}

const errors = [];

for (const file of forbiddenTrackedFiles) {
  if (trackedFiles.includes(file)) errors.push(`Real env file must not be committed: ${file}`);
}

const gitignore = fs.readFileSync(path.join(root, ".gitignore"), "utf8");
for (const pattern of [".env", "node_modules", ".next", "dist", "data/*.db", "logs", "secrets"]) {
  if (!gitignore.includes(pattern)) errors.push(`.gitignore is missing ${pattern}`);
}

for (const rel of trackedFiles) {
  if (rel === "scripts/security-check.mjs") continue;
  const full = path.join(root, rel);
  if (!fs.existsSync(full) || fs.statSync(full).isDirectory()) continue;
  const text = fs.readFileSync(full, "utf8");
  if (hasRealSecret(rel, text)) errors.push(`Possible committed secret or unsafe public secret in ${rel}`);
}

const apiSource = fs.readFileSync(path.join(root, "apps/web/lib/api.ts"), "utf8");
if (/localhost:4000/u.test(apiSource)) errors.push("Frontend API base must not default to localhost:4000");
if (!/credentials:\s*"include"/u.test(apiSource)) errors.push("Frontend fetch must include credentials");

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log("Security checks passed");
