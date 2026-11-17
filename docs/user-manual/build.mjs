#!/usr/bin/env node
//
// Rebuilds the oilan.ai mailbox user manual: Chinese and Kazakh versions,
// each as markdown, html and pdf.
//
//   node docs/user-manual/build.mjs
//
// Requirements: pandoc and Google Chrome.
//   1. cards.json -> images/<lang>/<name>.png (info cards, 980x572)
//   2. oilan-ai.<lang>.md -> oilan-ai.<lang>.html -> oilan-ai.<lang>.pdf
//
// The manuals never contain mailbox passwords. Passwords live only in
// sites/oilan/accounts.json on the oilan branch and are sent to each user by
// the mailbox maintainer.

import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const buildDir = join(here, ".build");
const chrome =
  process.env.CHROME_BIN ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const manuals = [
  { lang: "zh", title: "oilan.ai 邮箱使用手册", htmlLang: "zh-CN" },
  { lang: "kk", title: "oilan.ai поштасын пайдалану нұсқаулығы", htmlLang: "kk" },
];

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(command + " failed with exit status " + result.status);
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function renderRow(row) {
  const parts = [
    '<div class="row">',
    '<div class="left"><div class="label">',
    escapeHtml(row.label),
    '</div><div class="value">',
    escapeHtml(row.value),
    "</div></div>",
  ];
  if (row.hint) {
    parts.push('<div class="hint">' + escapeHtml(row.hint) + "</div>");
  }
  parts.push("</div>");
  return parts.join("");
}

function buildCards() {
  const template = readFileSync(join(here, "card-template.html"), "utf8");
  const cards = JSON.parse(readFileSync(join(here, "cards.json"), "utf8"));
  for (const [lang, list] of Object.entries(cards)) {
    const outDir = join(here, "images", lang);
    mkdirSync(outDir, { recursive: true });
    for (const card of list) {
      const html = template
        .replaceAll("__TITLE__", escapeHtml(card.title))
        .replaceAll("__SUBTITLE__", escapeHtml(card.subtitle))
        .replaceAll("__ROWS__", card.rows.map(renderRow).join(""));
      const htmlPath = join(buildDir, lang + "-" + card.name + ".html");
      writeFileSync(htmlPath, html);
      run(chrome, [
        "--headless",
        "--disable-gpu",
        "--hide-scrollbars",
        "--force-device-scale-factor=1",
        "--window-size=980,572",
        "--default-background-color=FFFFFFFF",
        "--virtual-time-budget=3000",
        "--screenshot=" + join(outDir, card.name + ".png"),
        "file://" + htmlPath,
      ]);
      console.log("card", lang, card.name);
    }
  }
}

function buildManuals() {
  for (const manual of manuals) {
    const fileBase = join(here, "oilan-ai." + manual.lang);
    const md = fileBase + ".md";
    const html = fileBase + ".html";
    const pdf = fileBase + ".pdf";
    run("pandoc", [
      md,
      "--from",
      "markdown",
      "--to",
      "html5",
      "--standalone",
      "--template",
      join(here, "template.html"),
      "--css",
      "manual.css",
      "--metadata",
      "title=" + manual.title,
      "--metadata",
      "lang=" + manual.htmlLang,
      "--output",
      html,
    ]);
    run(chrome, [
      "--headless",
      "--disable-gpu",
      "--no-pdf-header-footer",
      "--virtual-time-budget=8000",
      "--print-to-pdf=" + pdf,
      "file://" + html,
    ]);
    console.log("manual", manual.lang, "->", pdf);
  }
}

mkdirSync(buildDir, { recursive: true });
try {
  buildCards();
  buildManuals();
} finally {
  rmSync(buildDir, { recursive: true, force: true });
}
console.log("done");
