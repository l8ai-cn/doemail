import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyEmailOperation,
  createEmailOperationRecord,
} from "./email-policy.mjs";

test("domain connection plans include required DNS guidance", () => {
  const decision = classifyEmailOperation({
    operationType: "connect_domain",
    environment: "prod",
    domain: "example.com",
    mailHostname: "mail.example.com",
    publicIp: "203.0.113.10",
  });

  assert.equal(decision.riskLevel, "high");
  assert.equal(decision.approvalRequired, true);
  assert.deepEqual(decision.requiredGrants, ["email.domain.write"]);
  assert.deepEqual(
    decision.requiredDnsRecords.map((record) => record.type),
    ["A", "MX", "SPF", "DKIM", "DMARC", "rDNS"],
  );
  assert.match(decision.requiredDnsRecords[0].expected, /mail\.example\.com/);
  assert.match(decision.requiredDnsRecords[1].expected, /example\.com/);
});

test("self mailbox reads are audited and require mail read permission", () => {
  const decision = classifyEmailOperation({
    operationType: "read_mail",
    environment: "prod",
    mailboxAccess: "self",
    mailbox: "user@example.com",
  });

  assert.equal(decision.riskLevel, "medium");
  assert.equal(decision.approvalRequired, false);
  assert.equal(decision.auditRequired, true);
  assert.deepEqual(decision.requiredGrants, ["email.mail.read"]);
  assert.deepEqual(decision.requiredDnsRecords, []);
});

test("permission changes require approval and permission write access", () => {
  const decision = classifyEmailOperation({
    operationType: "permission_change",
    environment: "prod",
    mailbox: "finance@example.com",
  });

  assert.equal(decision.riskLevel, "high");
  assert.equal(decision.approvalRequired, true);
  assert.equal(decision.evidenceRequired, true);
  assert.deepEqual(decision.requiredGrants, ["email.permission.write"]);
});

test("password resets require account write approval", () => {
  const decision = classifyEmailOperation({
    operationType: "reset_password",
    environment: "prod",
    mailbox: "admin@example.com",
  });

  assert.equal(decision.riskLevel, "high");
  assert.equal(decision.approvalRequired, true);
  assert.equal(decision.evidenceRequired, true);
  assert.deepEqual(decision.requiredGrants, ["email.account.write"]);
});

test("Kubernetes runtime changes always require runtime admin access", () => {
  const decision = classifyEmailOperation({
    operationType: "runtime_change",
    environment: "staging",
    runtime: "kubernetes",
  });

  assert.equal(decision.riskLevel, "high");
  assert.equal(decision.approvalRequired, true);
  assert.equal(decision.runtimeMode, "kubernetes-mail-runtime");
  assert.deepEqual(decision.requiredGrants, ["email.runtime.admin"]);
});

test("operation records preserve audit fields and reject passwords", () => {
  assert.throws(
    () =>
      createEmailOperationRecord({
        domainId: "dom_example",
        environmentId: "prod",
        operationType: "create_account",
        actor: {
          type: "user",
          id: "u_001",
        },
        target: {
          mailbox: "new.user@example.com",
        },
        secret: {
          password: "never-store-this",
        },
        requestedAt: "2026-07-05T06:10:00.000Z",
      }),
    /secret.password must not be stored in operation records/,
  );

  const record = createEmailOperationRecord({
    domainId: "dom_example",
    environmentId: "prod",
    operationType: "create_account",
    actor: {
      type: "user",
      id: "u_001",
    },
    target: {
      mailbox: "new.user@example.com",
    },
    requestedAt: "2026-07-05T06:10:00.000Z",
  });

  assert.equal(record.operationType, "create_account");
  assert.equal(record.classification.approvalRequired, true);
  assert.equal(record.proxy.mode, "doemail-agent-proxy");
  assert.equal(record.audit.captured, true);
  assert.match(record.operationId, /^emailop_[a-f0-9]{16}$/);
  assert.equal(record.target.mailbox, "new.user@example.com");
});
