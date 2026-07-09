# DoEmail Troubleshooting

Use this guide when DoEmail cannot connect a domain, deploy a runtime, create an
account, send mail, receive mail or run a listener.

Start from the failing layer. Do not hide a failing layer behind an alternate
execution path.

## Quick Triage

| Symptom | First check |
| --- | --- |
| Domain not connected | `dns evaluate` result and exact DNS records. |
| Runtime unavailable | `k8s inspect-plan` commands and pod/PVC state. |
| Account command fails | Runtime `setup email list` and operation policy. |
| Cannot send mail | Sender account, TCP `587`, SMTP rejection, DNS/rDNS. |
| Cannot receive mail | `A`, `MX`, TCP `25`, mailbox existence and logs. |
| Cannot read inbox | IMAPS `993`, credentials, mailbox permission. |
| Listener repeats tasks | State file and processed `Message-ID` values. |
| External forwarding blocked | Approval state for high-risk forwarding. |

## DNS Problems

Generate expected records:

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs dns plan \
  --domain example.com \
  --mail-hostname mail.example.com \
  --public-ip 203.0.113.10
```

Collect observed values:

```bash
dig +short A mail.example.com
dig +short MX example.com
dig +short TXT example.com
dig +short TXT default._domainkey.example.com
dig +short TXT _dmarc.example.com
dig +short -x 203.0.113.10
```

Evaluate:

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs diagnose inbound \
  --domain example.com \
  --mail-hostname mail.example.com \
  --public-ip 203.0.113.10 \
  --actual-json '<observed-dns-json>'
```

Common root causes:

- `A` points to the wrong node IP.
- `MX` points to a hostname that does not resolve to the mail node.
- SPF does not authorize the MX path.
- DKIM record is missing because the runtime has not generated a public key.
- DMARC record is absent or points reports to an invalid mailbox.
- rDNS/PTR is missing at the IP provider.

## Kubernetes Runtime Problems

Generate the read-only check plan:

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs k8s inspect-plan \
  --namespace mail \
  --deployment l8ai-mail \
  --mail-hostname mail.example.com \
  --public-ip 203.0.113.10
```

Core checks:

```bash
kubectl -n mail get deploy,pod,pvc,svc -o wide
kubectl -n mail logs deploy/l8ai-mail --tail=100
kubectl -n mail exec deploy/l8ai-mail -- setup email list
kubectl -n mail exec deploy/l8ai-mail -- df -h /var/mail /var/mail-state /tmp/docker-mailserver
```

If a PVC is not bound, fix storage before changing accounts. If the pod is not
ready, inspect container logs and runtime config before changing DNS.

## Account And Password Problems

List accounts:

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs account list-plan \
  --namespace mail \
  --deployment l8ai-mail \
  --domain-id dom_example \
  --environment-id prod \
  --actor-type user \
  --actor-id admin_001
```

Reset password by Secret reference only:

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs account reset-password-plan \
  --namespace mail \
  --deployment l8ai-mail \
  --domain-id dom_example \
  --environment-id prod \
  --actor-type user \
  --actor-id admin_001 \
  --mailbox alice@example.com \
  --password-secret-ref k8s://mail/secret/alice/password
```

If a manifest is involved, validate it before planning:

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs account manifest-validate \
  --accounts-file /absolute/path/accounts.json
```

Rejected manifests usually contain plaintext password fields, unsupported
account roles or invalid mailbox addresses.

## Send And Receive Problems

For send failures:

1. Confirm sender mailbox exists.
2. Confirm the user has `email.mail.send`.
3. Check TCP `587` from the application network.
4. Capture SMTP server rejection text.
5. For external delivery, verify SPF, DKIM, DMARC and rDNS.

For receive failures:

1. Confirm `A` and `MX` point to the mail node.
2. Check TCP `25` from an external network.
3. Confirm recipient mailbox exists.
4. Inspect runtime logs.
5. Search the recipient mailbox by `Message-ID`.

Generate a receive smoke plan:

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs mail receive-test-plan \
  --namespace mail \
  --deployment l8ai-mail \
  --domain-id dom_example \
  --environment-id prod \
  --actor-type user \
  --actor-id u_001 \
  --from alice@example.com \
  --to bob@example.com \
  --subject "DoEmail receive smoke"
```

## Permission Problems

Permission changes require `email.permission.write`. Self mailbox reads require
`email.mail.read`; reading another mailbox requires an explicit mailbox access
decision and audit record.

External forwarding can expose mail outside the managed domain. If a forwarding
plan returns no runtime commands, check the approval gate instead of trying a
manual runtime change.

## Listener Problems

If a listener does not fire:

- confirm the poll command finds messages;
- confirm subject/query filters match the message metadata;
- confirm `maxPerRun` is greater than zero;
- confirm previous state does not already contain the message id.

If a listener fires repeatedly:

- inspect `state-file`;
- verify `listener record-result` ran after the Agent task;
- verify messages have stable `Message-ID` values.

If a listener attempts a blocked action, create a separate audited operation and
approval path. Do not weaken the listener guardrail.
