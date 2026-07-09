# Management Testing Runbook

Use this runbook to generate DoEmail management test plans through the Skill
script before executing anything on a selected doagent target.

The script prints JSON plans. It does not execute Kubernetes or mail mutations
by itself.

For a command-by-command reference, use `cli-reference.md`. This page focuses on
management test scenarios that combine those commands into repeatable checks.

## DNS Plan

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs dns plan \
  --domain l8ai.cn \
  --mail-hostname mail.l8ai.cn \
  --public-ip 89.250.81.244
```

## DNS Evaluation

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs dns evaluate \
  --domain l8ai.cn \
  --mail-hostname mail.l8ai.cn \
  --public-ip 89.250.81.244 \
  --actual-json '{"A":["89.250.81.244"],"MX":["10 mail.l8ai.cn."],"SPF":["\"v=spf1 mx -all\""],"DKIM":["\"v=DKIM1; k=rsa; p=<public-key>\""],"DMARC":["\"v=DMARC1; p=none; rua=mailto:postmaster@l8ai.cn\""],"rDNS":["mail.l8ai.cn."]}'
```

## Developer Integration Guide

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs integration guide \
  --domain l8ai.cn \
  --mail-hostname mail.l8ai.cn \
  --from no-reply@l8ai.cn \
  --languages java,python,nodejs
```

The guide includes Kubernetes Secret/ConfigMap examples and language examples
that read credentials from environment variables.
SMTP/IMAPS default to `mail-hostname:587` and `mail-hostname:993`; override
them only when the runtime exposes different endpoints.

## Kubernetes Read-Only Check Plan

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs k8s inspect-plan \
  --namespace mail \
  --deployment l8ai-mail \
  --mail-hostname mail.l8ai.cn \
  --public-ip 89.250.81.244
```

## Account Create Plan

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs account create-plan \
  --namespace mail \
  --deployment l8ai-mail \
  --domain-id dom_l8ai \
  --environment-id prod \
  --actor-type user \
  --actor-id u_001 \
  --mailbox new.user@l8ai.cn \
  --password-secret-ref k8s://mail/secret/new-user/password
```

## Account List Plan

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs account list-plan \
  --namespace mail \
  --deployment l8ai-mail \
  --domain-id dom_l8ai \
  --environment-id prod \
  --actor-type user \
  --actor-id u_001
```

## Account Reset Password Plan

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs account reset-password-plan \
  --namespace mail \
  --deployment l8ai-mail \
  --domain-id dom_l8ai \
  --environment-id prod \
  --actor-type user \
  --actor-id u_001 \
  --mailbox admin@l8ai.cn \
  --password-secret-ref k8s://mail/secret/admin/password
```

The returned plan uses `setup email update` and a Secret reference placeholder.
Do not put plaintext passwords in flags, manifests, docs or ledgers.

## Account Manifest Validate/Plan

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs account manifest-validate \
  --accounts-file /absolute/path/accounts.json

node DoSuite/DoEmail/Skill/scripts/doemail.mjs account manifest-plan \
  --namespace mail \
  --deployment l8ai-mail \
  --actor-type user \
  --actor-id u_001 \
  --accounts-file /absolute/path/accounts.json
```

## Bulk Account Distribution Plan

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs account bulk-create-plan \
  --namespace mail \
  --deployment l8ai-mail \
  --domain-id dom_l8ai \
  --environment-id prod \
  --actor-type user \
  --actor-id u_001 \
  --accounts-json '[{"mailbox":"alice@l8ai.cn","passwordSecretRef":"k8s://mail/secret/alice/password","quota":"1G"},{"mailbox":"bob@l8ai.cn","passwordSecretRef":"k8s://mail/secret/bob/password","quota":"2G"}]'
```

## Account Disable Plan

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs account disable-plan \
  --namespace mail \
  --deployment l8ai-mail \
  --domain-id dom_l8ai \
  --environment-id prod \
  --actor-type user \
  --actor-id u_001 \
  --mailbox old.user@l8ai.cn
```

## Account Offboard Plan

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs account offboard-plan \
  --namespace mail \
  --deployment l8ai-mail \
  --domain-id dom_l8ai \
  --environment-id prod \
  --actor-type user \
  --actor-id u_001 \
  --mailbox leaver@l8ai.cn \
  --retention preserve
```

This restricts send and receive while preserving PVC-backed mailbox data. It
does not plan `setup email del`.

## Send Mail Plan

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs mail send-plan \
  --namespace mail \
  --deployment l8ai-mail \
  --domain-id dom_l8ai \
  --environment-id prod \
  --actor-type user \
  --actor-id u_001 \
  --from postmaster@l8ai.cn \
  --to gjq@l8ai.cn \
  --message-ref file:///tmp/doemail-smoke.eml
```

## Read Mail Plan

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs mail read-plan \
  --namespace mail \
  --deployment l8ai-mail \
  --domain-id dom_l8ai \
  --environment-id prod \
  --actor-type user \
  --actor-id u_001 \
  --mailbox gjq@l8ai.cn \
  --query ALL \
  --mailbox-access self
```

## Receive Test Plan

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs mail receive-test-plan \
  --namespace mail \
  --deployment l8ai-mail \
  --domain-id dom_l8ai \
  --environment-id prod \
  --actor-type user \
  --actor-id u_001 \
  --from postmaster@l8ai.cn \
  --to gjq@l8ai.cn \
  --subject "DoEmail receive smoke"
```

## Intent Onboarding Plan

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs intent plan \
  --intent onboard_department \
  --namespace mail \
  --deployment l8ai-mail \
  --domain-id dom_l8ai \
  --environment-id prod \
  --actor-type user \
  --actor-id u_001 \
  --domain l8ai.cn \
  --accounts-json '[{"mailbox":"sales1@l8ai.cn","passwordSecretRef":"k8s://mail/secret/sales1/password","quota":"1G"}]' \
  --group sales@l8ai.cn
```

The returned workflow composes bulk account creation, distribution-group
membership and a tagged receive test.

## Persistence Check Plan

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs k8s persistence-plan \
  --namespace mail \
  --deployment l8ai-mail \
  --data-pvc l8ai-mail-data \
  --state-pvc l8ai-mail-state \
  --config-pvc l8ai-mail-config
```

## Ledger Append/List

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs ledger append \
  --ledger-file /var/lib/doemail/operations.jsonl \
  --record-json '<operation-record-json>'

node DoSuite/DoEmail/Skill/scripts/doemail.mjs ledger list \
  --ledger-file /var/lib/doemail/operations.jsonl
```

## Alias Plan

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs permission alias-plan \
  --namespace mail \
  --deployment l8ai-mail \
  --domain-id dom_l8ai \
  --environment-id prod \
  --actor-type user \
  --actor-id u_001 \
  --alias team@l8ai.cn \
  --recipient gjq@l8ai.cn
```

## Quota Plan

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs permission quota-plan \
  --namespace mail \
  --deployment l8ai-mail \
  --domain-id dom_l8ai \
  --environment-id prod \
  --actor-type user \
  --actor-id u_001 \
  --mailbox gjq@l8ai.cn \
  --quota 2G
```

## Shared Mailbox Plan

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs permission shared-mailbox-plan \
  --namespace mail \
  --deployment l8ai-mail \
  --domain-id dom_l8ai \
  --environment-id prod \
  --actor-type user \
  --actor-id u_001 \
  --mailbox support@l8ai.cn \
  --members alice@l8ai.cn,bob@l8ai.cn \
  --send-as allowed
```

## Distribution Group Plan

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs permission distribution-group-plan \
  --namespace mail \
  --deployment l8ai-mail \
  --domain-id dom_l8ai \
  --environment-id prod \
  --actor-type user \
  --actor-id u_001 \
  --group all@l8ai.cn \
  --recipients alice@l8ai.cn,bob@l8ai.cn \
  --posting-policy internal-only
```

## Forwarding Approval Plan

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs permission forwarding-plan \
  --namespace mail \
  --deployment l8ai-mail \
  --domain-id dom_l8ai \
  --environment-id prod \
  --actor-type user \
  --actor-id u_001 \
  --mailbox finance@l8ai.cn \
  --forward-to external@example.com
```

External forwarding returns an empty `runtimeCommands` list until explicit
approval is captured.

## DKIM Plan

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs security dkim-plan \
  --namespace mail \
  --deployment l8ai-mail \
  --domain-id dom_l8ai \
  --environment-id prod \
  --actor-type user \
  --actor-id u_001 \
  --domain l8ai.cn \
  --selector default \
  --key-size 2048
```

Publish the returned `TXT` record only after the runtime command has generated
the public key and the DNS change is approved.

## Inbound Diagnosis

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs diagnose inbound \
  --domain l8ai.cn \
  --mail-hostname mail.l8ai.cn \
  --public-ip 89.250.81.244 \
  --actual-json '{"A":["198.18.2.164"],"MX":["1 mail.l8ai.cn."],"SPF":["\"v=spf1 mx -all\""],"DKIM":[],"DMARC":["\"v=DMARC1; p=none; rua=mailto:postmaster@l8ai.cn\""],"rDNS":[]}'
```

## Evidence Package

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs evidence package \
  --operation-json '<operation-record-json>' \
  --verification-json '{"commands":["kubectl -n mail exec deploy/l8ai-mail -- setup email list"],"results":["mailbox present"]}'
```

## Listener Create Plan

For listener design, state handling and failure handling, use `listeners.md`.

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs listener create-plan \
  --namespace mail \
  --deployment l8ai-mail \
  --domain-id dom_l8ai \
  --environment-id prod \
  --actor-type user \
  --actor-id u_001 \
  --listener-id support-inbox \
  --mailbox support@l8ai.cn \
  --query ALL \
  --subject-contains urgent \
  --action agent_task \
  --prompt-template "Summarize and triage this message" \
  --state-file /var/lib/doemail/listeners/support-inbox.json \
  --max-per-run 3
```

## Listener Poll Plan

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs listener poll-plan \
  --namespace mail \
  --deployment l8ai-mail \
  --listener-id support-inbox \
  --mailbox support@l8ai.cn \
  --query ALL \
  --max-per-run 5
```

## Listener Evaluate

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs listener evaluate \
  --listener-json '<listener-config-json>' \
  --messages-json '<message-metadata-json-array>' \
  --state-json '<listener-state-json>'
```

The result includes selected messages, Agent task payloads, blocked actions and
the next state. Persist the next state only after the task outcome is recorded.

## Listener State Record

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs listener record-result \
  --state-file /var/lib/doemail/listeners/support-inbox.json \
  --listener-id support-inbox \
  --processed-message-ids msg-a@l8ai.cn,msg-b@l8ai.cn
```

## Natural Mail Commands

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs intent mail-command \
  --intent send_mail \
  --namespace mail \
  --deployment l8ai-mail \
  --domain-id dom_l8ai \
  --environment-id prod \
  --actor-type user \
  --actor-id u_001 \
  --from alice@l8ai.cn \
  --to bob@l8ai.cn \
  --subject "hello" \
  --body "Please review the report."

node DoSuite/DoEmail/Skill/scripts/doemail.mjs intent mail-command \
  --intent check_new_mail \
  --namespace mail \
  --deployment l8ai-mail \
  --domain-id dom_l8ai \
  --environment-id prod \
  --actor-type user \
  --actor-id u_001 \
  --mailbox bob@l8ai.cn \
  --query ALL \
  --mailbox-access self
```

## Execution Gate

Run these plans first. Execute the returned runtime commands only after the
operator confirms the exact target, mailbox/domain and approval state.
