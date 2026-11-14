import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { renderUserGuide } from "./mail-clients.mjs";
import {
  MAINTENANCE_RULES,
  accountMessage,
  openAccount,
  readAccountPassword,
} from "./site-branches.mjs";

const repoRoot = new URL("../..", import.meta.url);

test("agent.md cites every maintenance rule", () => {
  const agent = readFileSync(new URL("../../agent.md", import.meta.url), "utf8");
  for (const rule of MAINTENANCE_RULES) {
    assert.match(agent, new RegExp(rule.id.replaceAll(".", "\\.")));
    assert.ok(agent.includes(rule.text), rule.id);
  }
});

test("readme contains the generated user guide", () => {
  const readme = readFileSync(new URL("../../README.md", import.meta.url), "utf8");
  assert.ok(readme.includes(renderUserGuide()));
});

test("open account stores the password only in the site file", () => {
  const file = join(mkdtempSync(join(tmpdir(), "doemail-")), "accounts.json");
  const opened = openAccount({
    site: "oilan",
    mailbox: "user@oilan.ai",
    password: "branch-secret",
    accountsFile: file,
  });
  assert.equal(opened.created, true);
  assert.equal(JSON.stringify(opened).includes("branch-secret"), false);
  assert.equal(readAccountPassword("oilan", "user@oilan.ai", file).password, "branch-secret");
  assert.match(accountMessage({
    site: "oilan",
    mailbox: "user@oilan.ai",
    password: "branch-secret",
  }), /密码：branch-secret/);
});

test("open account rejects a mailbox outside the site domain", () => {
  assert.throws(
    () => openAccount({
      site: "l8ai",
      mailbox: "user@oilan.ai",
      accountsFile: join(tmpdir(), "unused.json"),
    }),
    /不属于 l8ai\.cn/,
  );
});

test("repo root used by the rules is this DoEmail checkout", () => {
  assert.equal(repoRoot.pathname.endsWith("/DoEmail/"), true);
});
