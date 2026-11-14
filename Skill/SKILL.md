---
name: doemail-agent
description: DoEmail 邮箱原生助手。用于通过 doagent 在 Kubernetes 邮件运行时中连接邮箱域名、创建账号、收发邮件、管理权限、监听邮箱事件、生成 Java/Python/Node.js 开发者接入指南、检查 DNS/MX/SPF/DKIM/DMARC/rDNS 和输出证据。
---

# DoEmail Agent

DoEmail follows the DoOps interaction model: connect to a gateway, select a
target, then ask doagent to operate the Kubernetes mail runtime through the
DoEmail Skill or CLI.

The Skill is the primary user experience. It should guide the user from intent
to verified mail service state.

## Intended Capabilities

- Connect a mail domain to the Kubernetes mail runtime.
- Tell the user exactly which DNS records to create.
- Verify `A`, `MX`, `SPF`, `DKIM`, `DMARC` and reverse DNS records.
- Create, disable and list mailbox accounts.
- Maintain account manifest files with roles, statuses, quotas and password
  Secret references.
- Send test mail and capture SMTP evidence.
- Read or search mailbox content when mailbox permissions allow it.
- Watch mailbox messages through bounded run-once listeners and emit Agent task
  payloads.
- Manage aliases, forwarding, mailbox access and quotas.
- Generate developer integration guides for Kubernetes, Java, Python and
  Node.js SMTP/IMAP clients.
- Inspect Kubernetes pod, PVC, config, SMTP and IMAPS health.
- Return evidence for every mutating operation.

## Operating Rules

- Use the selected doagent target. Do not operate a mail runtime from a local
  workstation unless that target is the selected target.
- Treat Kubernetes as the first runtime path.
- Read `agent.md` and `Server/lib/site-branches.mjs` before maintaining a site.
  The user connection steps are the “用户如何对接邮箱” section of `README.md`.
- main stores the Skill and rules. l8ai and oilan branches store that site's
  mailbox passwords in `sites/<site>/accounts.json`.
- Open an account with `account open` on the matching branch, then create it in
  that site's Deployment. Send the address and password with `account send`.
- Do not store mailbox passwords, API keys, private keys or tokens in operation
  records. A sent account message may contain the password in its body.
- Do not put plaintext passwords in account manifests. Use `passwordSecretRef`
  such as `k8s://mail/secret/admin/password`. Site branch account files are the
  exception named above.
- Before claiming a domain is connected, verify DNS records and reverse DNS.
- Before claiming mail can be sent externally, verify SMTP delivery and reverse
  DNS.
- If a required record, port, pod, PVC, credential or permission is missing,
  report the exact missing item and the expected value.
- Run listeners as bounded `run-once` evaluations unless a separate Server worker
  owns scheduling, locking, rate limiting and escalation.
- Listener-triggered external sending, mail deletion, account mutation, DNS
  updates and runtime changes require explicit approval before execution.

## Local Resource Bootstrap

- Before planning mail work, read `config/resources.json` for the l8ai mail
  runtime template, namespace, deployment, mail hostname and verification list.
- The resource file does not prove the runtime is live. Verify DNS, reverse DNS,
  Kubernetes pods/PVCs, SMTP and IMAPS before claiming mail is ready.

## User-Facing DNS Prompt

When a user asks to connect a domain, collect:

- domain, for example `example.com`;
- mail hostname, for example `mail.example.com`;
- public mail IP;
- DKIM selector, defaulting to `default` unless the runtime has a different
  selector.

Then show this record set with the user's real values:

```text
A      mail.example.com                 203.0.113.10
MX     example.com                      10 mail.example.com.
TXT    example.com                      "v=spf1 mx -all"
TXT    default._domainkey.example.com   "v=DKIM1; k=rsa; p=<dkim-public-key>"
TXT    _dmarc.example.com               "v=DMARC1; p=none; rua=mailto:postmaster@example.com"
rDNS   203.0.113.10                     mail.example.com
```

Explain that reverse DNS is configured at the IP or cloud provider.

## Detailed Runbooks

- `docs/domain-setup.md`
- `docs/account-management.md`
- `docs/mail-operations.md`
- `docs/integration-guide.md`
- `docs/listeners.md`
- `docs/permissions.md`
- `docs/cli-reference.md`
- `docs/management-testing.md`
- `docs/troubleshooting.md`

## Local Planning Script

Use `scripts/doemail.mjs` to create JSON plans before executing changes:

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs dns plan \
  --domain example.com \
  --mail-hostname mail.example.com \
  --public-ip 203.0.113.10
```

The script can also generate account, send/read mail, permission and Kubernetes
inspection plans. It does not execute production mutations by itself.

Use `docs/cli-reference.md` for the complete command surface. Use
`docs/management-testing.md` for end-to-end test scenarios.

Listener and intent examples:

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs listener evaluate \
  --listener-json '<listener-config-json>' \
  --messages-json '<fetched-message-json-array>' \
  --state-json '<listener-state-json>'

node DoSuite/DoEmail/Skill/scripts/doemail.mjs intent mail-command \
  --intent send_mail \
  --namespace mail \
  --deployment l8ai-mail \
  --domain-id dom_l8ai \
  --environment-id prod \
  --actor-type user \
  --actor-id u_001 \
  --from alice@example.com \
  --to bob@example.com \
  --subject hello \
  --body 'hello from DoEmail'
```

Account manifest example:

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs account manifest-validate \
  --accounts-file /absolute/path/accounts.json

node DoSuite/DoEmail/Skill/scripts/doemail.mjs account reset-password-plan \
  --namespace mail \
  --deployment l8ai-mail \
  --domain-id dom_l8ai \
  --environment-id prod \
  --actor-type user \
  --actor-id u_001 \
  --mailbox admin@example.com \
  --password-secret-ref k8s://mail/secret/admin/password
```

Developer integration guide example:

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs integration guide \
  --domain example.com \
  --mail-hostname mail.example.com \
  --from no-reply@example.com \
  --languages java,python,nodejs
```

`--smtp-host`, `--smtp-port`, `--imap-host` and `--imap-port` are optional when
they match the mail hostname and standard ports `587` and `993`.
