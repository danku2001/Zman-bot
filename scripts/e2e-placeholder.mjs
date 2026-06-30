import fs from "node:fs";

const hasPlaywright = fs.existsSync("node_modules/@playwright/test");

if (!hasPlaywright) {
  console.log("Playwright is not installed; skipping browser E2E. Server sync-flow QA still runs in npm test.");
  process.exit(0);
}

console.log("Playwright is installed, but no browser E2E suite is configured yet.");
