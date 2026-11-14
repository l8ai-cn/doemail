import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const scriptPath = new URL("./doemail.mjs", import.meta.url);

function runJson(args) {
  const output = execFileSync(process.execPath, [scriptPath.pathname, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return JSON.parse(output);
}

test("dns plan prints the required mail domain records", () => {
  const plan = runJson([
    "dns",
    "plan",
    "--domain",
    "example.com",
    "--mail-hostname",
    "mail.example.com",
    "--public-ip",
    "203.0.113.10",
  ]);

  assert.deepEqual(
    plan.records.map((record) => record.type),
    ["A", "MX", "SPF", "DKIM", "DMARC", "rDNS"],
  );
  assert.equal(plan.records[0].expected, "mail.example.com. A 203.0.113.10");
  assert.match(plan.verificationCommands.join("\n"), /dig \+short MX example\.com/);
});

test("dns evaluate reports exact missing and mismatched records", () => {
  const report = runJson([
    "dns",
    "evaluate",
    "--domain",
    "l8ai.cn",
    "--mail-hostname",
    "mail.l8ai.cn",
    "--public-ip",
    "89.250.81.244",
    "--actual-json",
    JSON.stringify({
      A: ["198.18.2.164"],
      MX: ["1 mail.l8ai.cn."],
      SPF: ['"v=spf1 mx -all"'],
      DKIM: [],
      DMARC: ['"v=DMARC1; p=none; rua=mailto:postmaster@l8ai.cn"'],
      rDNS: [],
    }),
  ]);

  assert.equal(report.status, "misaligned");
  assert.deepEqual(
    report.results
      .filter((result) => result.status !== "ok")
      .map((result) => result.type),
    ["A", "DKIM", "rDNS"],
  );
  assert.match(report.results[0].expected, /89\.250\.81\.244/);
  assert.match(report.results[0].actual.join(" "), /198\.18\.2\.164/);
});

test("operation record creates audited account-management envelopes", () => {
  const record = runJson([
    "operation",
    "record",
    "--operation-type",
    "create_account",
    "--domain-id",
    "dom_l8ai",
    "--environment-id",
    "prod",
    "--actor-type",
    "user",
    "--actor-id",
    "u_001",
    "--mailbox",
    "new.user@l8ai.cn",
  ]);

  assert.equal(record.operationType, "create_account");
  assert.equal(record.classification.approvalRequired, true);
  assert.deepEqual(record.classification.requiredGrants, ["email.account.write"]);
  assert.equal(record.target.mailbox, "new.user@l8ai.cn");
  assert.equal(record.proxy.mode, "doemail-agent-proxy");
});

test("k8s inspect plan emits read-only alignment commands", () => {
  const plan = runJson([
    "k8s",
    "inspect-plan",
    "--namespace",
    "mail",
    "--deployment",
    "l8ai-mail",
    "--mail-hostname",
    "mail.l8ai.cn",
    "--public-ip",
    "89.250.81.244",
  ]);

  assert.equal(plan.readOnly, true);
  assert.equal(plan.namespace, "mail");
  assert.match(plan.commands.join("\n"), /kubectl -n mail get deploy,pod,pvc -o wide/);
  assert.match(plan.commands.join("\n"), /setup email list/);
  assert.doesNotMatch(plan.commands.join("\n"), /\bkubectl (apply|delete|create)\b/);
});

test("account create plan uses a secret reference and docker-mailserver setup", () => {
  const plan = runJson([
    "account",
    "create-plan",
    "--namespace",
    "mail",
    "--deployment",
    "l8ai-mail",
    "--domain-id",
    "dom_l8ai",
    "--environment-id",
    "prod",
    "--actor-type",
    "user",
    "--actor-id",
    "u_001",
    "--mailbox",
    "new.user@l8ai.cn",
    "--password-secret-ref",
    "k8s://mail/secret/new-user/password",
  ]);

  assert.equal(plan.operation.operationType, "create_account");
  assert.match(plan.runtimeCommands[0], /setup email add new\.user@l8ai\.cn/);
  assert.match(plan.runtimeCommands[0], /<password-from:k8s:\/\/mail\/secret\/new-user\/password>/);
  assert.doesNotMatch(JSON.stringify(plan), /never-store|plain-password/);
});

test("account disable plan restricts both sending and receiving", () => {
  const plan = runJson([
    "account",
    "disable-plan",
    "--namespace",
    "mail",
    "--deployment",
    "l8ai-mail",
    "--domain-id",
    "dom_l8ai",
    "--environment-id",
    "prod",
    "--actor-type",
    "user",
    "--actor-id",
    "u_001",
    "--mailbox",
    "old.user@l8ai.cn",
  ]);

  assert.equal(plan.operation.operationType, "disable_account");
  assert.match(plan.runtimeCommands.join("\n"), /setup email restrict add send old\.user@l8ai\.cn/);
  assert.match(plan.runtimeCommands.join("\n"), /setup email restrict add receive old\.user@l8ai\.cn/);
});

test("mail send and read plans produce audited command plans", () => {
  const sendPlan = runJson([
    "mail",
    "send-plan",
    "--namespace",
    "mail",
    "--deployment",
    "l8ai-mail",
    "--domain-id",
    "dom_l8ai",
    "--environment-id",
    "prod",
    "--actor-type",
    "user",
    "--actor-id",
    "u_001",
    "--from",
    "postmaster@l8ai.cn",
    "--to",
    "gjq@l8ai.cn",
    "--message-ref",
    "file:///tmp/doemail-smoke.eml",
  ]);

  assert.equal(sendPlan.operation.operationType, "send_mail");
  assert.deepEqual(sendPlan.operation.classification.requiredGrants, ["email.mail.send"]);
  assert.match(sendPlan.runtimeCommands[0], /sendmail -f postmaster@l8ai\.cn gjq@l8ai\.cn/);

  const readPlan = runJson([
    "mail",
    "read-plan",
    "--namespace",
    "mail",
    "--deployment",
    "l8ai-mail",
    "--domain-id",
    "dom_l8ai",
    "--environment-id",
    "prod",
    "--actor-type",
    "user",
    "--actor-id",
    "u_001",
    "--mailbox",
    "gjq@l8ai.cn",
    "--query",
    "ALL",
    "--mailbox-access",
    "self",
  ]);

  assert.equal(readPlan.operation.operationType, "read_mail");
  assert.match(readPlan.runtimeCommands[0], /doveadm search -u gjq@l8ai\.cn mailbox INBOX ALL/);
  assert.equal(readPlan.operation.classification.auditRequired, true);
});

test("permission plans cover aliases and quotas", () => {
  const aliasPlan = runJson([
    "permission",
    "alias-plan",
    "--namespace",
    "mail",
    "--deployment",
    "l8ai-mail",
    "--domain-id",
    "dom_l8ai",
    "--environment-id",
    "prod",
    "--actor-type",
    "user",
    "--actor-id",
    "u_001",
    "--alias",
    "team@l8ai.cn",
    "--recipient",
    "gjq@l8ai.cn",
  ]);

  assert.equal(aliasPlan.operation.operationType, "permission_change");
  assert.match(aliasPlan.runtimeCommands[0], /setup alias add team@l8ai\.cn gjq@l8ai\.cn/);

  const quotaPlan = runJson([
    "permission",
    "quota-plan",
    "--namespace",
    "mail",
    "--deployment",
    "l8ai-mail",
    "--domain-id",
    "dom_l8ai",
    "--environment-id",
    "prod",
    "--actor-type",
    "user",
    "--actor-id",
    "u_001",
    "--mailbox",
    "gjq@l8ai.cn",
    "--quota",
    "2G",
  ]);

  assert.equal(quotaPlan.operation.operationType, "permission_change");
  assert.match(quotaPlan.runtimeCommands[0], /setup quota set gjq@l8ai\.cn 2G/);
});

test("bulk account distribution creates one audited plan per mailbox", () => {
  const plan = runJson([
    "account",
    "bulk-create-plan",
    "--namespace",
    "mail",
    "--deployment",
    "l8ai-mail",
    "--domain-id",
    "dom_l8ai",
    "--environment-id",
    "prod",
    "--actor-type",
    "user",
    "--actor-id",
    "admin_001",
    "--accounts-json",
    JSON.stringify([
      {
        mailbox: "alice@l8ai.cn",
        passwordSecretRef: "k8s://mail/secret/alice/password",
        quota: "1G",
      },
      {
        mailbox: "bob@l8ai.cn",
        passwordSecretRef: "k8s://mail/secret/bob/password",
        quota: "2G",
      },
    ]),
  ]);

  assert.equal(plan.kind, "bulk_account_create_plan");
  assert.equal(plan.accounts.length, 2);
  assert.equal(plan.accounts[0].operation.operationType, "create_account");
  assert.match(plan.accounts[0].runtimeCommands.join("\n"), /setup email add alice@l8ai\.cn/);
  assert.match(plan.accounts[0].runtimeCommands.join("\n"), /setup quota set alice@l8ai\.cn 1G/);
  assert.match(plan.accounts[1].runtimeCommands.join("\n"), /setup email add bob@l8ai\.cn/);
});

test("receive test plan sends a tagged message and searches recipient inbox", () => {
  const plan = runJson([
    "mail",
    "receive-test-plan",
    "--namespace",
    "mail",
    "--deployment",
    "l8ai-mail",
    "--domain-id",
    "dom_l8ai",
    "--environment-id",
    "prod",
    "--actor-type",
    "user",
    "--actor-id",
    "admin_001",
    "--from",
    "postmaster@l8ai.cn",
    "--to",
    "gjq@l8ai.cn",
    "--subject",
    "DoEmail receive smoke",
  ]);

  assert.equal(plan.kind, "receive_test_plan");
  assert.equal(plan.send.operation.operationType, "send_mail");
  assert.equal(plan.read.operation.operationType, "read_mail");
  assert.match(plan.messageId, /^doemail-smoke-[a-f0-9]{16}@l8ai\.cn$/);
  assert.match(plan.send.runtimeCommands.join("\n"), /sendmail -f postmaster@l8ai\.cn gjq@l8ai\.cn/);
  assert.match(plan.read.runtimeCommands.join("\n"), /HEADER Message-ID/);
});

test("persistence plan checks PVCs and mounted mail data paths without mutations", () => {
  const plan = runJson([
    "k8s",
    "persistence-plan",
    "--namespace",
    "mail",
    "--deployment",
    "l8ai-mail",
    "--data-pvc",
    "l8ai-mail-data",
    "--state-pvc",
    "l8ai-mail-state",
    "--config-pvc",
    "l8ai-mail-config",
  ]);

  assert.equal(plan.readOnly, true);
  assert.match(plan.commands.join("\n"), /kubectl -n mail get pvc l8ai-mail-data l8ai-mail-state l8ai-mail-config -o wide/);
  assert.match(plan.commands.join("\n"), /df -h \/var\/mail \/var\/mail-state \/tmp\/docker-mailserver/);
  assert.doesNotMatch(plan.commands.join("\n"), /\bkubectl (apply|delete|create|patch)\b/);
});

test("ledger append and list persist operation records as jsonl", () => {
  const dir = mkdtempSync(join(tmpdir(), "doemail-ledger-"));
  const ledgerFile = join(dir, "operations.jsonl");
  const record = runJson([
    "operation",
    "record",
    "--operation-type",
    "create_account",
    "--domain-id",
    "dom_l8ai",
    "--environment-id",
    "prod",
    "--actor-type",
    "user",
    "--actor-id",
    "admin_001",
    "--mailbox",
    "ledger.user@l8ai.cn",
  ]);

  const appendResult = runJson([
    "ledger",
    "append",
    "--ledger-file",
    ledgerFile,
    "--record-json",
    JSON.stringify(record),
  ]);

  assert.equal(appendResult.appended.operationId, record.operationId);
  assert.equal(readFileSync(ledgerFile, "utf8").trim().split("\n").length, 1);

  const listResult = runJson([
    "ledger",
    "list",
    "--ledger-file",
    ledgerFile,
  ]);

  assert.equal(listResult.records.length, 1);
  assert.equal(listResult.records[0].operationId, record.operationId);
});

test("intent plan composes onboarding workflow with approval gates", () => {
  const plan = runJson([
    "intent",
    "plan",
    "--intent",
    "onboard_department",
    "--namespace",
    "mail",
    "--deployment",
    "l8ai-mail",
    "--domain-id",
    "dom_l8ai",
    "--environment-id",
    "prod",
    "--actor-type",
    "user",
    "--actor-id",
    "admin_001",
    "--domain",
    "l8ai.cn",
    "--accounts-json",
    JSON.stringify([
      {
        mailbox: "sales1@l8ai.cn",
        passwordSecretRef: "k8s://mail/secret/sales1/password",
        quota: "1G",
      },
    ]),
    "--group",
    "sales@l8ai.cn",
  ]);

  assert.equal(plan.intent, "onboard_department");
  assert.equal(plan.workflow.length, 3);
  assert.deepEqual(plan.approvalGates, ["account_distribution", "distribution_group"]);
  assert.equal(plan.workflow[0].kind, "bulk_account_create_plan");
  assert.equal(plan.workflow[1].kind, "distribution_group_plan");
  assert.equal(plan.workflow[2].kind, "receive_test_plan");
});

test("offboarding plan disables account and preserves mailbox data", () => {
  const plan = runJson([
    "account",
    "offboard-plan",
    "--namespace",
    "mail",
    "--deployment",
    "l8ai-mail",
    "--domain-id",
    "dom_l8ai",
    "--environment-id",
    "prod",
    "--actor-type",
    "user",
    "--actor-id",
    "admin_001",
    "--mailbox",
    "leaver@l8ai.cn",
    "--retention",
    "preserve",
  ]);

  assert.equal(plan.kind, "offboard_account_plan");
  assert.match(plan.runtimeCommands.join("\n"), /setup email restrict add send leaver@l8ai\.cn/);
  assert.match(plan.runtimeCommands.join("\n"), /setup email restrict add receive leaver@l8ai\.cn/);
  assert.equal(plan.retention.mode, "preserve");
  assert.doesNotMatch(plan.runtimeCommands.join("\n"), /setup email del/);
});

test("shared mailbox plan models members and send-as policy", () => {
  const plan = runJson([
    "permission",
    "shared-mailbox-plan",
    "--namespace",
    "mail",
    "--deployment",
    "l8ai-mail",
    "--domain-id",
    "dom_l8ai",
    "--environment-id",
    "prod",
    "--actor-type",
    "user",
    "--actor-id",
    "admin_001",
    "--mailbox",
    "support@l8ai.cn",
    "--members",
    "alice@l8ai.cn,bob@l8ai.cn",
    "--send-as",
    "allowed",
  ]);

  assert.equal(plan.kind, "shared_mailbox_plan");
  assert.equal(plan.members.length, 2);
  assert.equal(plan.sendAs, "allowed");
  assert.match(plan.runtimeCommands.join("\n"), /setup alias add support@l8ai\.cn alice@l8ai\.cn/);
  assert.match(plan.runtimeCommands.join("\n"), /setup alias add support@l8ai\.cn bob@l8ai\.cn/);
  assert.equal(plan.operation.classification.approvalRequired, true);
});

test("distribution group plan supports multi-recipient internal-only groups", () => {
  const plan = runJson([
    "permission",
    "distribution-group-plan",
    "--namespace",
    "mail",
    "--deployment",
    "l8ai-mail",
    "--domain-id",
    "dom_l8ai",
    "--environment-id",
    "prod",
    "--actor-type",
    "user",
    "--actor-id",
    "admin_001",
    "--group",
    "all@l8ai.cn",
    "--recipients",
    "alice@l8ai.cn,bob@l8ai.cn",
    "--posting-policy",
    "internal-only",
  ]);

  assert.equal(plan.kind, "distribution_group_plan");
  assert.equal(plan.recipients.length, 2);
  assert.equal(plan.postingPolicy, "internal-only");
  assert.match(plan.runtimeCommands.join("\n"), /setup alias add all@l8ai\.cn alice@l8ai\.cn/);
  assert.match(plan.runtimeCommands.join("\n"), /setup alias add all@l8ai\.cn bob@l8ai\.cn/);
});

test("external forwarding plan is blocked without explicit approval", () => {
  const plan = runJson([
    "permission",
    "forwarding-plan",
    "--namespace",
    "mail",
    "--deployment",
    "l8ai-mail",
    "--domain-id",
    "dom_l8ai",
    "--environment-id",
    "prod",
    "--actor-type",
    "user",
    "--actor-id",
    "admin_001",
    "--mailbox",
    "finance@l8ai.cn",
    "--forward-to",
    "external@example.com",
  ]);

  assert.equal(plan.kind, "forwarding_plan");
  assert.equal(plan.requiresExplicitApproval, true);
  assert.equal(plan.blockedUntilApproved, true);
  assert.deepEqual(plan.runtimeCommands, []);
});

test("DKIM plan produces runtime and DNS publication steps", () => {
  const plan = runJson([
    "security",
    "dkim-plan",
    "--namespace",
    "mail",
    "--deployment",
    "l8ai-mail",
    "--domain-id",
    "dom_l8ai",
    "--environment-id",
    "prod",
    "--actor-type",
    "user",
    "--actor-id",
    "admin_001",
    "--domain",
    "l8ai.cn",
    "--selector",
    "default",
    "--key-size",
    "2048",
  ]);

  assert.equal(plan.kind, "dkim_plan");
  assert.match(plan.runtimeCommands.join("\n"), /setup config dkim/);
  assert.equal(plan.dnsRecord.type, "TXT");
  assert.equal(plan.dnsRecord.name, "default._domainkey.l8ai.cn.");
  assert.equal(plan.operation.classification.approvalRequired, true);
});

test("diagnose plan ranks root causes from observed state", () => {
  const diagnosis = runJson([
    "diagnose",
    "inbound",
    "--domain",
    "l8ai.cn",
    "--mail-hostname",
    "mail.l8ai.cn",
    "--public-ip",
    "89.250.81.244",
    "--actual-json",
    JSON.stringify({
      A: ["198.18.2.164"],
      MX: ["1 mail.l8ai.cn."],
      SPF: ['"v=spf1 mx -all"'],
      DKIM: [],
      DMARC: ['"v=DMARC1; p=none; rua=mailto:postmaster@l8ai.cn"'],
      rDNS: [],
    }),
  ]);

  assert.equal(diagnosis.status, "action_required");
  assert.equal(diagnosis.findings[0].type, "A");
  assert.match(diagnosis.findings[0].impact, /mail hostname/);
  assert.ok(diagnosis.nextActions.length >= 2);
});

test("evidence package combines operations and verification commands", () => {
  const operation = runJson([
    "operation",
    "record",
    "--operation-type",
    "create_account",
    "--domain-id",
    "dom_l8ai",
    "--environment-id",
    "prod",
    "--actor-type",
    "user",
    "--actor-id",
    "admin_001",
    "--mailbox",
    "evidence@l8ai.cn",
  ]);
  const pack = runJson([
    "evidence",
    "package",
    "--operation-json",
    JSON.stringify(operation),
    "--verification-json",
    JSON.stringify({
      commands: ["kubectl -n mail exec deploy/l8ai-mail -- setup email list"],
      results: ["evidence@l8ai.cn present"],
    }),
  ]);

  assert.equal(pack.operationId, operation.operationId);
  assert.equal(pack.status, "evidence_ready");
  assert.equal(pack.verification.commands.length, 1);
  assert.match(pack.summary, /create_account/);
});

test("listener create plan defines a bounded mailbox watcher", () => {
  const plan = runJson([
    "listener",
    "create-plan",
    "--namespace",
    "mail",
    "--deployment",
    "l8ai-mail",
    "--domain-id",
    "dom_l8ai",
    "--environment-id",
    "prod",
    "--actor-type",
    "user",
    "--actor-id",
    "admin_001",
    "--listener-id",
    "support-inbox",
    "--mailbox",
    "support@l8ai.cn",
    "--query",
    "ALL",
    "--subject-contains",
    "urgent",
    "--action",
    "agent_task",
    "--prompt-template",
    "Summarize and triage this message",
    "--state-file",
    "/var/lib/doemail/listeners/support-inbox.json",
    "--max-per-run",
    "3",
  ]);

  assert.equal(plan.kind, "listener_config_plan");
  assert.equal(plan.listener.listenerId, "support-inbox");
  assert.equal(plan.listener.mailbox, "support@l8ai.cn");
  assert.equal(plan.listener.rateLimit.maxPerRun, 3);
  assert.equal(plan.listener.action.type, "agent_task");
  assert.equal(plan.listener.approvalPolicy.externalSend, "block");
});

test("listener poll plan emits read-only doveadm discovery commands", () => {
  const plan = runJson([
    "listener",
    "poll-plan",
    "--namespace",
    "mail",
    "--deployment",
    "l8ai-mail",
    "--listener-id",
    "support-inbox",
    "--mailbox",
    "support@l8ai.cn",
    "--query",
    "ALL",
    "--max-per-run",
    "5",
  ]);

  assert.equal(plan.kind, "listener_poll_plan");
  assert.equal(plan.readOnly, true);
  assert.match(plan.runtimeCommands.join("\n"), /doveadm search -u support@l8ai\.cn mailbox INBOX ALL/);
  assert.match(plan.runtimeCommands.join("\n"), /doveadm fetch -u support@l8ai\.cn/);
  assert.doesNotMatch(plan.runtimeCommands.join("\n"), /setup email (add|del|restrict)/);
});

test("listener evaluate filters messages, deduplicates state and emits agent tasks", () => {
  const evaluation = runJson([
    "listener",
    "evaluate",
    "--listener-json",
    JSON.stringify({
      listenerId: "support-inbox",
      mailbox: "support@l8ai.cn",
      query: "ALL",
      filters: {
        subjectContains: "urgent",
      },
      action: {
        type: "agent_task",
        promptTemplate: "Summarize and triage this message",
      },
      rateLimit: {
        maxPerRun: 1,
      },
      approvalPolicy: {
        externalSend: "block",
      },
    }),
    "--messages-json",
    JSON.stringify([
      {
        uid: "42",
        messageId: "msg-duplicate@l8ai.cn",
        from: "customer@example.com",
        to: "support@l8ai.cn",
        subject: "urgent: existing issue",
        receivedAt: "2026-07-05T08:00:00Z",
        snippet: "Already handled",
      },
      {
        uid: "43",
        messageId: "msg-new@l8ai.cn",
        from: "customer@example.com",
        to: "support@l8ai.cn",
        subject: "urgent: new issue",
        receivedAt: "2026-07-05T08:01:00Z",
        snippet: "Please help",
      },
      {
        uid: "44",
        messageId: "msg-ignore@l8ai.cn",
        from: "customer@example.com",
        to: "support@l8ai.cn",
        subject: "newsletter",
        receivedAt: "2026-07-05T08:02:00Z",
        snippet: "Ignore",
      },
    ]),
    "--state-json",
    JSON.stringify({
      processedMessageIds: ["msg-duplicate@l8ai.cn"],
    }),
  ]);

  assert.equal(evaluation.kind, "listener_evaluation");
  assert.equal(evaluation.selectedMessages.length, 1);
  assert.equal(evaluation.selectedMessages[0].messageId, "msg-new@l8ai.cn");
  assert.equal(evaluation.agentTasks.length, 1);
  assert.match(evaluation.agentTasks[0].prompt, /urgent: new issue/);
  assert.deepEqual(evaluation.counters, {
    input: 3,
    duplicate: 1,
    filtered: 1,
    selected: 1,
    rateLimited: 0,
  });
  assert.ok(evaluation.nextState.processedMessageIds.includes("msg-new@l8ai.cn"));
});

test("listener evaluate blocks direct external-send actions without approval", () => {
  const evaluation = runJson([
    "listener",
    "evaluate",
    "--listener-json",
    JSON.stringify({
      listenerId: "finance-inbox",
      mailbox: "finance@l8ai.cn",
      action: {
        type: "send_mail",
        to: "external@example.com",
      },
      rateLimit: {
        maxPerRun: 2,
      },
      approvalPolicy: {
        externalSend: "block",
      },
    }),
    "--messages-json",
    JSON.stringify([
      {
        uid: "45",
        messageId: "msg-finance@l8ai.cn",
        from: "finance@l8ai.cn",
        to: "finance@l8ai.cn",
        subject: "wire request",
        receivedAt: "2026-07-05T08:03:00Z",
        snippet: "Please wire funds",
      },
    ]),
    "--state-json",
    JSON.stringify({
      processedMessageIds: [],
    }),
  ]);

  assert.equal(evaluation.agentTasks.length, 0);
  assert.equal(evaluation.blockedActions.length, 1);
  assert.match(evaluation.blockedActions[0].reason, /external send/);
});

test("listener record result persists processed message state", () => {
  const dir = mkdtempSync(join(tmpdir(), "doemail-listener-"));
  const stateFile = join(dir, "support-inbox.json");
  const result = runJson([
    "listener",
    "record-result",
    "--state-file",
    stateFile,
    "--listener-id",
    "support-inbox",
    "--processed-message-ids",
    "msg-a@l8ai.cn,msg-b@l8ai.cn",
  ]);

  assert.equal(result.listenerId, "support-inbox");
  assert.equal(result.recorded.processedMessageIds.length, 2);
  const persisted = JSON.parse(readFileSync(stateFile, "utf8"));
  assert.deepEqual(persisted.processedMessageIds, ["msg-a@l8ai.cn", "msg-b@l8ai.cn"]);
});

test("mail command intent turns a user send request into an executable send plan", () => {
  const plan = runJson([
    "intent",
    "mail-command",
    "--intent",
    "send_mail",
    "--namespace",
    "mail",
    "--deployment",
    "l8ai-mail",
    "--domain-id",
    "dom_l8ai",
    "--environment-id",
    "prod",
    "--actor-type",
    "user",
    "--actor-id",
    "admin_001",
    "--from",
    "alice@l8ai.cn",
    "--to",
    "bob@l8ai.cn",
    "--subject",
    "hello",
    "--body",
    "Please review the report.",
  ]);

  assert.equal(plan.kind, "mail_command_plan");
  assert.equal(plan.intent, "send_mail");
  assert.equal(plan.send.operation.operationType, "send_mail");
  assert.match(plan.send.runtimeCommands.join("\n"), /Subject: hello/);
  assert.match(plan.send.runtimeCommands.join("\n"), /sendmail -f alice@l8ai\.cn bob@l8ai\.cn/);
});

test("mail command intent turns a user inbox question into a read plan", () => {
  const plan = runJson([
    "intent",
    "mail-command",
    "--intent",
    "check_new_mail",
    "--namespace",
    "mail",
    "--deployment",
    "l8ai-mail",
    "--domain-id",
    "dom_l8ai",
    "--environment-id",
    "prod",
    "--actor-type",
    "user",
    "--actor-id",
    "admin_001",
    "--mailbox",
    "bob@l8ai.cn",
    "--query",
    "ALL",
    "--mailbox-access",
    "self",
  ]);

  assert.equal(plan.kind, "mail_command_plan");
  assert.equal(plan.intent, "check_new_mail");
  assert.equal(plan.read.operation.operationType, "read_mail");
  assert.match(plan.read.runtimeCommands.join("\n"), /doveadm search -u bob@l8ai\.cn mailbox INBOX ALL/);
});

test("account list plan is read-only and uses docker-mailserver account list", () => {
  const plan = runJson([
    "account",
    "list-plan",
    "--namespace",
    "mail",
    "--deployment",
    "l8ai-mail",
    "--domain-id",
    "dom_l8ai",
    "--environment-id",
    "prod",
    "--actor-type",
    "user",
    "--actor-id",
    "admin_001",
  ]);

  assert.equal(plan.kind, "account_list_plan");
  assert.equal(plan.readOnly, true);
  assert.equal(plan.operation.operationType, "inspect");
  assert.match(plan.runtimeCommands.join("\n"), /setup email list/);
  assert.doesNotMatch(plan.runtimeCommands.join("\n"), /setup email (add|update|del|restrict)/);
});

test("account reset password plan uses only a secret reference", () => {
  const plan = runJson([
    "account",
    "reset-password-plan",
    "--namespace",
    "mail",
    "--deployment",
    "l8ai-mail",
    "--domain-id",
    "dom_l8ai",
    "--environment-id",
    "prod",
    "--actor-type",
    "user",
    "--actor-id",
    "admin_001",
    "--mailbox",
    "admin@l8ai.cn",
    "--password-secret-ref",
    "k8s://mail/secret/admin/password",
  ]);

  assert.equal(plan.kind, "reset_password_plan");
  assert.equal(plan.operation.operationType, "reset_password");
  assert.match(plan.runtimeCommands[0], /setup email update admin@l8ai\.cn/);
  assert.match(plan.runtimeCommands[0], /<password-from:k8s:\/\/mail\/secret\/admin\/password>/);
  assert.doesNotMatch(JSON.stringify(plan), /example-cleartext-not-allowed|plainPassword|passwordHash/);
});

test("account manifest validate accepts secret references and admin roles", () => {
  const dir = mkdtempSync(join(tmpdir(), "doemail-accounts-"));
  const manifestFile = join(dir, "accounts.json");
  writeFileSync(
    manifestFile,
    JSON.stringify({
      kind: "DoEmailAccountManifest",
      apiVersion: "doemail.l8ai.cn/v1",
      domainId: "dom_l8ai",
      environmentId: "prod",
      domain: "l8ai.cn",
      accounts: [
        {
          mailbox: "admin@l8ai.cn",
          role: "admin",
          status: "active",
          passwordSecretRef: "k8s://mail/secret/admin/password",
          quota: "2G",
        },
        {
          mailbox: "service@l8ai.cn",
          role: "service",
          status: "disabled",
          passwordSecretRef: "k8s://mail/secret/service/password",
        },
      ],
    }),
  );

  const validation = runJson([
    "account",
    "manifest-validate",
    "--accounts-file",
    manifestFile,
  ]);

  assert.equal(validation.kind, "account_manifest_validation");
  assert.equal(validation.valid, true);
  assert.equal(validation.counts.total, 2);
  assert.equal(validation.counts.admin, 1);
  assert.deepEqual(validation.accounts.map((account) => account.role), ["admin", "service"]);
});

test("account manifest validate rejects plaintext passwords", () => {
  const dir = mkdtempSync(join(tmpdir(), "doemail-accounts-bad-"));
  const manifestFile = join(dir, "accounts.json");
  writeFileSync(
    manifestFile,
    JSON.stringify({
      kind: "DoEmailAccountManifest",
      apiVersion: "doemail.l8ai.cn/v1",
      domainId: "dom_l8ai",
      environmentId: "prod",
      domain: "l8ai.cn",
      accounts: [
        {
          mailbox: "admin@l8ai.cn",
          role: "admin",
          status: "active",
          password: "example-cleartext-not-allowed",
        },
      ],
    }),
  );

  assert.throws(
    () =>
      runJson([
        "account",
        "manifest-validate",
        "--accounts-file",
        manifestFile,
      ]),
    /password must not be stored in account manifests/,
  );
});

test("account manifest plan emits account lifecycle actions from file", () => {
  const dir = mkdtempSync(join(tmpdir(), "doemail-accounts-plan-"));
  const manifestFile = join(dir, "accounts.json");
  writeFileSync(
    manifestFile,
    JSON.stringify({
      kind: "DoEmailAccountManifest",
      apiVersion: "doemail.l8ai.cn/v1",
      domainId: "dom_l8ai",
      environmentId: "prod",
      domain: "l8ai.cn",
      accounts: [
        {
          mailbox: "admin@l8ai.cn",
          role: "admin",
          status: "active",
          passwordSecretRef: "k8s://mail/secret/admin/password",
          quota: "2G",
        },
        {
          mailbox: "old@l8ai.cn",
          role: "user",
          status: "disabled",
          passwordSecretRef: "k8s://mail/secret/old/password",
        },
      ],
    }),
  );

  const plan = runJson([
    "account",
    "manifest-plan",
    "--namespace",
    "mail",
    "--deployment",
    "l8ai-mail",
    "--actor-type",
    "user",
    "--actor-id",
    "admin_001",
    "--accounts-file",
    manifestFile,
  ]);

  assert.equal(plan.kind, "account_manifest_plan");
  assert.equal(plan.actions.length, 2);
  assert.equal(plan.actions[0].role, "admin");
  assert.match(plan.actions[0].runtimeCommands.join("\n"), /setup email add admin@l8ai\.cn/);
  assert.match(plan.actions[0].runtimeCommands.join("\n"), /setup quota set admin@l8ai\.cn 2G/);
  assert.match(plan.actions[1].runtimeCommands.join("\n"), /setup email restrict add send old@l8ai\.cn/);
});

test("integration guide renders Kubernetes, Java, Python and Node.js sections", () => {
  const guide = runJson([
    "integration",
    "guide",
    "--domain",
    "l8ai.cn",
    "--mail-hostname",
    "mail.l8ai.cn",
    "--smtp-host",
    "mail.l8ai.cn",
    "--smtp-port",
    "587",
    "--imap-host",
    "mail.l8ai.cn",
    "--imap-port",
    "993",
    "--from",
    "no-reply@l8ai.cn",
    "--languages",
    "java,python,nodejs",
  ]);

  assert.equal(guide.kind, "integration_guide");
  assert.deepEqual(guide.languages, ["java", "python", "nodejs"]);
  assert.match(guide.markdown, /Kubernetes Secret/);
  assert.match(guide.markdown, /Jakarta Mail/);
  assert.match(guide.markdown, /smtplib/);
  assert.match(guide.markdown, /nodemailer/);
  assert.match(guide.markdown, /imapflow/);
  assert.match(guide.markdown, /mail\.l8ai\.cn/);
  assert.match(guide.markdown, /SMTP_PORT/);
  assert.doesNotMatch(guide.markdown, /committed-secret-value|cleartext-password-value|MAIL_PASSWORD: [^<]/);
});

test("integration guide can render only one selected language", () => {
  const guide = runJson([
    "integration",
    "guide",
    "--domain",
    "l8ai.cn",
    "--mail-hostname",
    "mail.l8ai.cn",
    "--smtp-host",
    "mail.l8ai.cn",
    "--smtp-port",
    "587",
    "--imap-host",
    "mail.l8ai.cn",
    "--imap-port",
    "993",
    "--from",
    "no-reply@l8ai.cn",
    "--languages",
    "python",
  ]);

  assert.deepEqual(guide.languages, ["python"]);
  assert.match(guide.markdown, /Python/);
  assert.doesNotMatch(guide.markdown, /Jakarta Mail/);
  assert.doesNotMatch(guide.markdown, /nodemailer/);
});

test("integration guide defaults SMTP and IMAP endpoints from mail hostname", () => {
  const guide = runJson([
    "integration",
    "guide",
    "--domain",
    "l8ai.cn",
    "--mail-hostname",
    "mail.l8ai.cn",
    "--from",
    "no-reply@l8ai.cn",
    "--languages",
    "python",
  ]);

  assert.equal(guide.smtp.host, "mail.l8ai.cn");
  assert.equal(guide.smtp.port, 587);
  assert.equal(guide.imap.host, "mail.l8ai.cn");
  assert.equal(guide.imap.port, 993);
  assert.match(guide.markdown, /SMTP_HOST: mail\.l8ai\.cn/);
  assert.match(guide.markdown, /IMAP_PORT: "993"/);
});

test("GitOps base package defines repeatable Kubernetes mail runtime resources", () => {
  const baseDir = new URL("../Server/gitops/base/", import.meta.url);
  const kustomization = readFileSync(new URL("kustomization.yaml", baseDir), "utf8");
  const deployment = readFileSync(new URL("deployment.yaml", baseDir), "utf8");
  const service = readFileSync(new URL("service.yaml", baseDir), "utf8");
  const pvc = readFileSync(new URL("pvc.yaml", baseDir), "utf8");
  const secret = readFileSync(new URL("secret.example.yaml", baseDir), "utf8");

  assert.match(kustomization, /deployment\.yaml/);
  assert.match(deployment, /mailserver\/docker-mailserver:v15\.1\.0/);
  assert.match(deployment, /hostNetwork: true/);
  assert.match(deployment, /\/var\/mail/);
  assert.match(service, /port: 25/);
  assert.match(service, /port: 993/);
  assert.match(pvc, /l8ai-mail-data/);
  assert.match(secret, /MAIL_POSTMASTER_PASSWORD/);
  assert.doesNotMatch(secret, /committed-secret-value|cleartext-password-value/);
});

test("account open writes the password to the site file and not the plan", () => {
  const accountsFile = join(mkdtempSync(join(tmpdir(), "doemail-open-")), "accounts.json");
  const opened = runJson([
    "account",
    "open",
    "--site",
    "oilan",
    "--mailbox",
    "user@oilan.ai",
    "--password",
    "branch-secret",
    "--accounts-file",
    accountsFile,
  ]);

  assert.equal(opened.kind, "account_open");
  assert.equal(opened.operation.operationType, "create_account");
  assert.equal(JSON.stringify(opened).includes("branch-secret"), false);
  assert.match(readFileSync(accountsFile, "utf8"), /branch-secret/);
});

test("account send puts the password in the mail body only", () => {
  const accountsFile = join(mkdtempSync(join(tmpdir(), "doemail-send-")), "accounts.json");
  runJson([
    "account",
    "open",
    "--site",
    "l8ai",
    "--mailbox",
    "user@l8ai.cn",
    "--password",
    "send-secret",
    "--accounts-file",
    accountsFile,
  ]);
  const sent = runJson([
    "account",
    "send",
    "--site",
    "l8ai",
    "--mailbox",
    "user@l8ai.cn",
    "--to",
    "owner@example.com",
    "--accounts-file",
    accountsFile,
  ]);

  assert.equal(sent.kind, "account_send");
  assert.equal(sent.message.send.operation.target.password, undefined);
  assert.match(sent.message.send.runtimeCommands.join("\n"), /密码：send-secret/);
  assert.match(sent.message.send.runtimeCommands.join("\n"), /mail\.l8ai\.cn/);
});
