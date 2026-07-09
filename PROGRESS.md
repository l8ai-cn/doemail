# DoEmail Goal Progress

## Goal

Complete a goal-driven DoEmail development pass: make DoEmail usable for
Kubernetes mail-service alignment, Skill-driven domain guidance, mailbox
management planning, send/read/permission planning and verification against the
OL/OILAN mail server without unsafe production changes.

## Machine-Checkable Success Criteria

- `node DoSuite/DoEmail/Server/lib/email-policy.test.mjs` passes.
- DoEmail has a CLI/script entry that can produce domain DNS guidance from user
  inputs.
- DoEmail has a CLI/script entry that can classify and create audited operation
  records for domain, account, mail, permission and runtime operations.
- DoEmail has a documented OL/OILAN alignment procedure and a captured read-only
  check result.
- Skill docs explain how users configure `A`, `MX`, `SPF`, `DKIM`, `DMARC` and
  reverse DNS records.

## Failure Criteria

- The OL/OILAN doops target is unreachable.
- The current token lacks read-only access to Kubernetes or host mail checks.
- Tests fail and cannot be fixed without changing unrelated modules.
- A requested production mutation lacks explicit confirmation or required target
  details.

## Guardrails

- Remote checks are read-only unless a later step gets explicit confirmation for
  a concrete mutation.
- No mailbox passwords, private keys, API keys or tokens may be written into
  operation records or docs.
- No DNS, K8S, mailbox or mail-delivery production changes are made during the
  audit phase.

## Iterations

### 2026-07-05 Initial State

- Created product docs, Skill docs and `email-policy.mjs`.
- Verified policy tests passed before this goal pass.
- Next: inspect local gaps, inspect OL/OILAN mail server read-only, then add
  concrete Skill script tooling and tests.

### 2026-07-05 OL/OILAN Read-Only Probe

- `doops list` shows `gw-oilan-node -> doops-oilan/oilan-node`.
- `doops targets --target gw-oilan-node` shows the target online and idle.
- Host probe through `doops -session doemail_probe_20260705 exec` returned
  `gpu-ampere01`, user `root`, and `/usr/local/bin/kubectl`.
- Kubernetes mail state:
  - namespace `mail` exists;
  - deployment `l8ai-mail` is `1/1` available;
  - pod `l8ai-mail-6694bbc76c-wwpkm` is running on `gpu-ampere01`;
  - pod IP is `89.250.81.244`;
  - PVCs `l8ai-mail-data`, `l8ai-mail-state`, `l8ai-mail-config` are bound.
- Runtime shape matches the FDE Kubernetes model:
  - image `docker.io/mailserver/docker-mailserver:latest`;
  - `hostNetwork` behavior is visible through pod IP matching the public node IP;
  - container exposes host ports `25/TCP` and `993/TCP`;
  - `OVERRIDE_HOSTNAME=mail.l8ai.cn`;
  - `POSTMASTER_ADDRESS=postmaster@l8ai.cn`;
  - `ENABLE_OPENDKIM=0` and `ENABLE_OPENDMARC=0`.
- Runtime account list from `setup email list` shows:
  - `postmaster@l8ai.cn`;
  - `gjq@l8ai.cn`.
- DNS alignment from local public resolver checks:
  - `MX l8ai.cn` points to `mail.l8ai.cn`;
  - `TXT l8ai.cn` has SPF `"v=spf1 mx -all"`;
  - `_dmarc.l8ai.cn` has DMARC `p=none`;
  - `A mail.l8ai.cn` resolves to `198.18.2.164`, not `89.250.81.244`;
  - `default._domainkey.l8ai.cn` did not return a DKIM record;
  - PTR/rDNS for `89.250.81.244` did not return a hostname.
- Next: implement local Skill script tooling that exposes these checks and
  record envelopes in a repeatable way.

### 2026-07-05 Skill Script Development

- Added `DoSuite/DoEmail/Skill/scripts/doemail.mjs`.
- Added tests in `DoSuite/DoEmail/Skill/scripts/doemail.test.mjs`.
- Implemented JSON planning for:
  - DNS plan;
  - DNS evaluation;
  - Kubernetes read-only inspect plan;
  - account create plan;
  - account disable plan;
  - mail send plan;
  - mail read/search plan;
  - alias plan;
  - quota plan.
- Verified docker-mailserver management commands from the OL runtime:
  - `setup email add/update/del/restrict/list`;
  - `setup alias add/del/list`;
  - `setup quota set/del`;
  - `setup config dkim`.
- Generated sample scale-management plans for:
  - `scale.test@l8ai.cn` account creation;
  - `scale-team@l8ai.cn -> gjq@l8ai.cn` alias;
  - `postmaster@l8ai.cn -> gjq@l8ai.cn` internal send plan;
  - `gjq@l8ai.cn` quota plan.

### 2026-07-05 Production Alignment Boundary

- `l8ai.cn` authoritative NS is `dns7.hichina.com` and `dns8.hichina.com`.
- No local or OL/OILAN `ALIYUN_*` credentials were visible, so the A record
  cannot be changed safely in this session.
- `mail.l8ai.cn A` currently resolves to `198.18.2.164`; expected value for the
  OL mail runtime is `89.250.81.244`.
- DKIM is not enabled in the runtime (`ENABLE_OPENDKIM=0`) and the
  `default._domainkey.l8ai.cn` TXT record is missing.
- PTR/rDNS for `89.250.81.244` did not return `mail.l8ai.cn`; this must be set
  at the IP/cloud provider.
- Production mutations are ready as plans, but should not be executed until the
  operator confirms the exact target, credentials/secrets and approval state.

### 2026-07-05 Extended Skill Testing

- Added tests and implementation for:
  - bulk account distribution plans;
  - receive-test plans with a stable Message-ID;
  - Kubernetes persistence plans;
  - local JSONL operation ledger append/list.
- Re-ran `node DoSuite/DoEmail/Skill/scripts/doemail.test.mjs`: 12/12 pass.
- Ran OL/OILAN persistence read-only checks:
  - `l8ai-mail-data`, `l8ai-mail-state`, `l8ai-mail-config` are all `Bound`;
  - all three PVCs use `local-path`, are selected on `gpu-ampere01`, and are used
    by `l8ai-mail-6694bbc76c-wwpkm`;
  - `/var/mail`, `/var/mail-state`, `/tmp/docker-mailserver` all exist in the
    runtime container;
  - `df -h` shows those paths mounted on the host-backed filesystem.
- Added `Server/docs/market-feature-research.md` with mainstream product
  capability gaps and next-feature recommendations.

### 2026-07-05 Agent-Native Full Function Test Goal

Success criteria:

- DoEmail Skill tests cover intent-like planning, approval/apply simulation,
  onboarding, offboarding, shared mailbox, distribution group, external
  forwarding approval, DKIM plan, self-diagnosis and evidence package scenarios.
- The test command `node DoSuite/DoEmail/Skill/scripts/doemail.test.mjs` passes.
- The test command `node DoSuite/DoEmail/Server/lib/email-policy.test.mjs`
  passes.
- No OL/OILAN DNS, K8S resource, mailbox account or mail content is modified.

Failure criteria:

- Any test fails after implementation.
- Any new command requires a production mutation to verify.
- Any plan stores plaintext passwords, tokens, API keys or private keys.

Escalation boundary:

- Real `apply`, mailbox creation, alias changes, DKIM generation, DNS updates,
  and sending real messages remain human-confirmed production actions.

Result:

- Added full-function tests for:
  - intent-driven department onboarding workflow;
  - account offboarding with mailbox-data preservation;
  - shared mailbox membership and send-as policy;
  - distribution groups with internal posting policy;
  - external forwarding approval blocking;
  - DKIM runtime/DNS planning;
  - inbound-mail self-diagnosis from observed DNS state;
  - operation evidence packaging.
- Implemented matching JSON plan/package commands in
  `Skill/scripts/doemail.mjs`.
- Re-ran `node DoSuite/DoEmail/Skill/scripts/doemail.test.mjs`: 20/20 pass.
- The new commands are plan-only and did not modify OL/OILAN DNS, K8S
  resources, mailbox accounts or mail content.
- Re-ran OL/OILAN read-only health checks through
  `doops -session doemail_fulltest_20260705`:
  - `l8ai-mail` deployment is still `1/1` available;
  - `l8ai-mail-data`, `l8ai-mail-state`, `l8ai-mail-config` are still `Bound`;
  - `/var/mail`, `/var/mail-state`, `/tmp/docker-mailserver` exist and `df -h`
    reports mounted storage for all three paths;
  - account list remains `postmaster@l8ai.cn` and `gjq@l8ai.cn`.
- DNS read-only observation still shows `mail.l8ai.cn A -> 198.18.2.164`,
  `MX l8ai.cn -> mail.l8ai.cn`, SPF and DMARC present, DKIM and rDNS absent.

### 2026-07-05 Listener And Live Mail Test Goal

Goal:

- Add a DoEmail run-once mailbox listener that can evaluate fetched message
  metadata, de-duplicate processed messages, emit Agent task payloads and record
  listener state.
- Add deterministic mail-command intents for user requests such as sending mail
  and checking new mail.
- Run a real OL/OILAN test using temporary mailboxes, then delete the test
  accounts and mailbox data.

Implementation:

- Added listener commands:
  - `listener create-plan`;
  - `listener poll-plan`;
  - `listener evaluate`;
  - `listener record-result`.
- Added mail intent command:
  - `intent mail-command --intent send_mail`;
  - `intent mail-command --intent check_new_mail`.
- Added design and plan docs:
  - `docs/superpowers/specs/2026-07-05-doemail-listener-design.md`;
  - `docs/superpowers/plans/2026-07-05-doemail-listener.md`.
- Updated Skill docs and runbooks with listener guardrails and examples.

Local verification:

- Red test run: 20/27 pass, 7 listener/intent tests failed because commands were
  missing.
- Green test run: `node DoSuite/DoEmail/Skill/scripts/doemail.test.mjs` passed
  27/27.
- Full local verification passed:
  - `node DoSuite/DoEmail/Server/lib/email-policy.test.mjs`: 5/5 pass;
  - `node DoSuite/DoEmail/Skill/scripts/doemail.test.mjs`: 27/27 pass;
  - `node DoSuite/DoSql/Server/lib/change-policy.test.mjs`: 5/5 pass.

OL/OILAN live test:

- Created temporary accounts:
  - `doemail.live.a.20260705091011@l8ai.cn`;
  - `doemail.live.b.20260705091011@l8ai.cn`.
- Verified `setup email list` showed both temporary accounts.
- Sent real internal mail A -> B with Message-ID
  `doemail-live-a-to-b-20260705091011@l8ai.cn`.
- Sent real internal mail B -> A with Message-ID
  `doemail-live-b-to-a-20260705091011@l8ai.cn`.
- Verified both messages with `doveadm search`:
  - B inbox returned UID `1` for A -> B;
  - A inbox returned UID `1` for B -> A.
- Fetched real metadata for B inbox and evaluated listener
  `live-b-inbox-20260705091011`.
- Listener evaluation selected one real message and emitted Agent task
  `emailtask_ab1263916b973e3a`.
- Verified natural mail command send path:
  - `intent mail-command --intent send_mail` generated Message-ID
    `doemail-user-92a63b7422a68188@l8ai.cn`;
  - executing the returned runtime command sent the message from A to B.
- Verified natural mail command read path:
  - `intent mail-command --intent check_new_mail` generated a `doveadm search`
    plan;
  - executing it returned B inbox UID `2` for
    `doemail-user-92a63b7422a68188@l8ai.cn`.
- Tested account disable:
  - added send and receive restrict for A;
  - send restrict list showed A as `REJECT`;
  - receive restrict was confirmed in `postfix-receive-access.cf`.

Cleanup:

- Removed send and receive restrict for A.
- Deleted both temporary accounts.
- Initial `setup email del` removed accounts but kept mailbox data, so the same
  temporary accounts were briefly re-created and deleted with official
  `setup email del -y`.
- The `-y` cleanup confirmed deletion of mailbox data paths:
  - `/var/mail/l8ai.cn/doemail.live.a.20260705091011`;
  - `/var/mail/l8ai.cn/doemail.live.b.20260705091011`.
- Final account list returned to:
  - `postmaster@l8ai.cn`;
  - `gjq@l8ai.cn`.
- Final test directory/config residue checks did not return matching test account
  paths or config entries.

### 2026-07-05 Account Registry And Password Reset Goal

Goal:

- Add a reviewed account file for administrator, user, service and shared
  mailbox accounts.
- Keep password material out of git, CLI output and audit records.
- Add password reset planning and account list planning to the CLI.

Design:

- Added `DoEmailAccountManifest` with:
  - `kind: DoEmailAccountManifest`;
  - `apiVersion: doemail.l8ai.cn/v1`;
  - `domainId`, `environmentId`, `domain`;
  - account `mailbox`, `role`, `status`, `passwordSecretRef`, optional `quota`
    and `displayName`.
- Explicitly rejected `password`, `plainPassword`, `passwordHash`, `privateKey`,
  `token` and `apiKey` fields in account manifests.

Implementation:

- Added policy operation `reset_password` with `email.account.write` grant and
  production approval.
- Added CLI commands:
  - `account list-plan`;
  - `account reset-password-plan`;
  - `account manifest-validate`;
  - `account manifest-plan`.
- Added example manifest:
  - `Skill/examples/accounts.manifest.example.json`.

Verification:

- Red tests failed before implementation:
  - policy rejected `reset_password`;
  - CLI rejected the new account commands.
- Green tests after implementation:
  - `node DoSuite/DoEmail/Server/lib/email-policy.test.mjs`: 6/6 pass;
  - `node DoSuite/DoEmail/Skill/scripts/doemail.test.mjs`: 32/32 pass.

### 2026-07-05 Integration Guide And GitOps Goal

Goal:

- Add `integration guide` CLI for Kubernetes, Java, Python and Node.js
  application developers.
- Add a repeatable GitOps base package for a new Kubernetes mail runtime.

Implementation:

- Added `integration guide` command with:
  - Kubernetes Secret and ConfigMap guidance;
  - Java Jakarta Mail example;
  - Python `smtplib` and `imaplib` example;
  - Node.js `nodemailer` and `imapflow` example;
  - SMTP/IMAPS/DNS verification commands.
- Added GitOps package:
  - `Server/gitops/base/kustomization.yaml`;
  - `namespace.yaml`;
  - `configmap.yaml`;
  - `secret.example.yaml`;
  - `pvc.yaml`;
  - `service.yaml`;
  - `deployment.yaml`.
- Added `Server/gitops/README.md` and `Skill/docs/integration-guide.md`.

Verification:

- Red tests failed before implementation:
  - `integration guide` command missing;
  - GitOps base package missing.
- Green test after implementation:
  - `node DoSuite/DoEmail/Skill/scripts/doemail.test.mjs`: 36/36 pass.
- Full local verification after GitOps packaging:
  - `node DoSuite/DoEmail/Server/lib/email-policy.test.mjs`: 6/6 pass;
  - `node DoSuite/DoEmail/Skill/scripts/doemail.test.mjs`: 36/36 pass;
  - `node DoSuite/DoSql/Server/lib/change-policy.test.mjs`: 5/5 pass;
  - `kubectl kustomize DoSuite/DoEmail/Server/gitops/base` rendered
    successfully with 182 lines, including `Service`, three PVCs, `Deployment`,
    `hostNetwork: true` and
    `docker.io/mailserver/docker-mailserver:v15.1.0`;
  - delivery-surface scan found no `TBD`, `TODO`, `fallback`, `silent`, `静默`,
    `降级`, `committed-secret-value` or `cleartext-password-value` matches in
    DoEmail docs, GitOps manifests or implementation code.
- No GitOps package was applied to OL/OILAN in this pass.
- Follow-up usability fix: `integration guide` now defaults SMTP/IMAPS endpoints
  from `--mail-hostname` with ports `587` and `993`, while still allowing
  explicit endpoint overrides.

### 2026-07-05 Documentation Completion Pass

Goal:

- Make the DoEmail companion documentation usable by platform owners,
  Kubernetes operators, mail administrators, application developers,
  Agent/Skill developers and on-call operators.
- Keep docs aligned with the current CLI, policy tests and GitOps package.

Implementation:

- Added `Skill/docs/cli-reference.md` covering the full planning CLI surface.
- Added `Server/docs/gitops-deployment.md` for environment overlays, apply
  gates, verification and rollback.
- Added `Skill/docs/listeners.md` for bounded mailbox listener operation,
  state handling and scheduling boundaries.
- Added `Skill/docs/troubleshooting.md` for DNS, runtime, account, mail,
  permission and listener failures.
- Updated top-level, Server, Skill and GitOps READMEs with task-based document
  navigation.
- Updated existing runbooks to link the new CLI/listener docs.
- Aligned older runtime and market-research docs with current support for TCP
  `587`, shared-mailbox plans, distribution-group plans, external-forwarding
  approval blocking and DKIM planning.

Verification:

- `node DoSuite/DoEmail/Server/lib/email-policy.test.mjs`: 6/6 pass.
- `node DoSuite/DoEmail/Skill/scripts/doemail.test.mjs`: 36/36 pass.
- `node DoSuite/DoSql/Server/lib/change-policy.test.mjs`: 5/5 pass.
- `kubectl kustomize DoSuite/DoEmail/Server/gitops/base` rendered 182 lines.
- Required new documentation files and referenced example manifest exist.
- Delivery-surface scan found no `TBD`, `TODO`, `fallback`, `silent`, `静默`,
  `降级`, `committed-secret-value` or `cleartext-password-value` matches.
