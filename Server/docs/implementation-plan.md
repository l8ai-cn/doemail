# Implementation Plan

DoEmail should be built in phases. Each phase has a concrete verification
target.

## Phase 1: Product Boundary And Policy

Status: implemented locally.

Deliverables:

- product README and server docs;
- operation classification policy;
- grant, approval, evidence and audit decisions;
- DNS setup checklist for domain connection.
- Skill script plans for DNS, K8S inspection, account lifecycle, mail send/read,
  alias and quota operations.

Verification:

```bash
node DoSuite/DoEmail/Server/lib/email-policy.test.mjs
node DoSuite/DoEmail/Skill/scripts/doemail.test.mjs
```

## Phase 2: Agent CLI Contract

Status: implemented locally as a planning CLI.

Deliverables:

- `doemail` CLI request/response envelopes;
- domain plan/evaluate commands;
- account create, bulk create, disable, offboard, list, password reset and
  manifest commands;
- send, receive-test and mailbox read/search plans;
- permission, listener, DKIM, diagnosis and evidence-package commands.

Verification:

- fixture command tests;
- every mutating command requires an operation record ID;
- secret inputs are accepted only through environment variables or secret
  references.

## Phase 3: Kubernetes Runtime Automation

Status: GitOps base package implemented; environment overlays and production
apply remain environment-specific.

Deliverables:

- generated Kubernetes manifests for the mail runtime;
- PVC, hostname, port and certificate checks;
- mailbox account sync into the runtime;
- DKIM key generation and DNS instruction output.

Verification:

- local or test-cluster dry run;
- pod/PVC readiness checks;
- SMTP 25 and IMAPS 993 smoke tests.

## Phase 4: Mail Domain And Deliverability

Status: DNS guidance, DNS evaluation, DKIM plan and receive-test plans are
implemented locally. Production DNS/DKIM/rDNS alignment remains environment
specific.

Deliverables:

- DNS provider integration points;
- MX/SPF/DKIM/DMARC/rDNS verification;
- inbound delivery smoke test;
- outbound delivery smoke test after reverse DNS is confirmed.

Verification:

- `dig` checks match expected records;
- SMTP transcript captured;
- mailbox receives the smoke message.

## Phase 5: DoOps-Style UI

Deliverables:

- connect screen;
- target switcher;
- domain and mailbox views;
- conversation panel;
- evidence viewer.

Verification:

- browser path for domain setup guidance;
- browser path for account creation;
- browser path for sending and reading test mail.
