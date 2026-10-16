#!/usr/bin/env node
// Move an existing flow-map page onto the current template: node upgrade-page.mjs <page.html>
// The page keeps its JSON block; everything around it comes from template.html.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const file = process.argv[2];
if (!file) { console.error("usage: node upgrade-page.mjs <page.html>"); process.exit(2); }
const BLOCK = /(<script type="application\/json" id="flow">)([\s\S]*?)(<\/script>)/;
const page = readFileSync(file, "utf8").match(BLOCK);
if (!page) { console.error(`${file}: no flow JSON block`); process.exit(1); }
const data = JSON.parse(page[2]);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const template = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "template.html"), "utf8");
const out = template
  .replace(BLOCK, (m, open, body, close) => open + page[2] + close)
  .replace(/<html lang="[^"]*">/, `<html lang="${esc(data.lang || "en")}">`)
  .replace(/<title>[^<]*<\/title>/, `<title>${esc(data.title)}</title>`);
writeFileSync(file, out);
console.log(`${file}: moved onto the current template`);
