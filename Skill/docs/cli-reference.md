# DoEmail CLI Reference

`Skill/scripts/doemail.mjs` is the local planning and evidence helper used by
the DoEmail Skill. It emits JSON plans that an Agent can inspect, approve and
execute through the selected doagent target.

Most commands are plan-only. They do not run `kubectl`, `setup`, SMTP, IMAP or
DNS mutations. The exceptions are local file helpers: `ledger append`,
`ledger list` and `listener record-result`.

## Common Inputs

| Flag | Meaning |
| --- | --- |
| `--namespace` | Kubernetes namespace, for example `mail`. |
| `--deployment` | Mail runtime deployment, for example `l8ai-mail`. |
| `--domain-id` | DoEmail domain metadata id. |
| `--environment-id` | Environment id, for example `prod`. |
| `--actor-type` | Requesting actor type, usually `user` or `agent`. |
| `--actor-id` | Stable actor id used in audit records. |
| `--mailbox` | Mailbox address being read, changed or inspected. |
| `--password-secret-ref` | Secret reference such as `k8s://mail/secret/name/key`. |

Never pass plaintext passwords, tokens or private keys to the CLI. Use Secret
references or an approved secret store.

## Domain Commands

### `dns plan`

Creates the required DNS record table for connecting a domain.

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs dns plan \
  --domain example.com \
  --mail-hostname mail.example.com \
  --public-ip 203.0.113.10
```

Output use: show the user exact `A`, `MX`, `SPF`, `DKIM`, `DMARC` and rDNS
instructions.

### `dns evaluate`

Compares observed DNS values with the expected domain plan.

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs dns evaluate \
  --domain example.com \
  --mail-hostname mail.example.com \
  --public-ip 203.0.113.10 \
  --actual-json '{"A":["203.0.113.10"],"MX":["10 mail.example.com."],"SPF":["\"v=spf1 mx -all\""],"DKIM":["\"v=DKIM1; k=rsa; p=<public-key>\""],"DMARC":["\"v=DMARC1; p=none; rua=mailto:postmaster@example.com\""],"rDNS":["mail.example.com."]}'
```

Output use: report `aligned` or `misaligned` with exact missing or mismatched
records.

## Developer Integration

### `integration guide`

Generates a Kubernetes, Java, Python and Node.js application connection guide.

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs integration guide \
  --domain example.com \
  --mail-hostname mail.example.com \
  --from no-reply@example.com \
  --languages java,python,nodejs
```

SMTP defaults to `mail-hostname:587` with STARTTLS. IMAPS defaults to
`mail-hostname:993` with TLS. Override with `--smtp-host`, `--smtp-port`,
`--imap-host` and `--imap-port` only when the runtime exposes different
application endpoints.

Output use: give developers Secret/ConfigMap examples and language-specific
send/read snippets that load credentials from environment variables.

## Operation And Evidence

### `operation record`

Creates an audited operation envelope and policy classification.

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs operation record \
  --domain-id dom_example \
  --environment-id prod \
  --operation-type create_account \
  --actor-type user \
  --actor-id admin_001 \
  --mailbox alice@example.com
```

Supported operation types are `inspect`, `connect_domain`, `create_account`,
`reset_password`, `disable_account`, `send_mail`, `read_mail`,
`permission_change` and `runtime_change`.

### `evidence package`

Combines an operation record with verification commands and results.

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs evidence package \
  --operation-json '<operation-record-json>' \
  --verification-json '{"commands":["kubectl -n mail exec deploy/l8ai-mail -- setup email list"],"results":["alice@example.com present"]}'
```

Output use: return a single audit artifact after execution.

## Kubernetes Runtime Commands

### `k8s inspect-plan`

Generates read-only Kubernetes, SMTP and IMAPS inspection commands.

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs k8s inspect-plan \
  --namespace mail \
  --deployment l8ai-mail \
  --mail-hostname mail.example.com \
  --public-ip 203.0.113.10
```

### `k8s persistence-plan`

Generates read-only PVC and mount checks for mailbox data, state and config.

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs k8s persistence-plan \
  --namespace mail \
  --deployment l8ai-mail \
  --data-pvc l8ai-mail-data \
  --state-pvc l8ai-mail-state \
  --config-pvc l8ai-mail-config
```

## Account Commands

### `account create-plan`

Plans creation of one mailbox with a Secret reference.

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs account create-plan \
  --namespace mail \
  --deployment l8ai-mail \
  --domain-id dom_example \
  --environment-id prod \
  --actor-type user \
  --actor-id admin_001 \
  --mailbox alice@example.com \
  --password-secret-ref k8s://mail/secret/alice/password
```

### `account bulk-create-plan`

Plans multiple mailbox creations from JSON input.

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs account bulk-create-plan \
  --namespace mail \
  --deployment l8ai-mail \
  --domain-id dom_example \
  --environment-id prod \
  --actor-type user \
  --actor-id admin_001 \
  --accounts-json '[{"mailbox":"alice@example.com","passwordSecretRef":"k8s://mail/secret/alice/password","quota":"1G"}]'
```

### `account list-plan`

Generates a read-only runtime account list command.

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs account list-plan \
  --namespace mail \
  --deployment l8ai-mail \
  --domain-id dom_example \
  --environment-id prod \
  --actor-type user \
  --actor-id admin_001
```

### `account reset-password-plan`

Plans password reset from a Secret reference. It must not include the new
password value.

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

### `account disable-plan`

Plans send and receive restriction for a mailbox.

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs account disable-plan \
  --namespace mail \
  --deployment l8ai-mail \
  --domain-id dom_example \
  --environment-id prod \
  --actor-type user \
  --actor-id admin_001 \
  --mailbox alice@example.com
```

### `account offboard-plan`

Plans offboarding while preserving mailbox data by default.

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs account offboard-plan \
  --namespace mail \
  --deployment l8ai-mail \
  --domain-id dom_example \
  --environment-id prod \
  --actor-type user \
  --actor-id admin_001 \
  --mailbox alice@example.com \
  --retention preserve
```

### `account manifest-validate` and `account manifest-plan`

Validates and plans from a `DoEmailAccountManifest` file.

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs account manifest-validate \
  --accounts-file /absolute/path/accounts.json

node DoSuite/DoEmail/Skill/scripts/doemail.mjs account manifest-plan \
  --namespace mail \
  --deployment l8ai-mail \
  --actor-type user \
  --actor-id admin_001 \
  --accounts-file /absolute/path/accounts.json
```

## Mail Commands

### `mail send-plan`

Plans sending an existing message file.

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs mail send-plan \
  --namespace mail \
  --deployment l8ai-mail \
  --domain-id dom_example \
  --environment-id prod \
  --actor-type user \
  --actor-id u_001 \
  --from alice@example.com \
  --to bob@example.com \
  --message-ref file:///tmp/doemail-smoke.eml
```

### `mail read-plan`

Plans a mailbox search/read operation.

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs mail read-plan \
  --namespace mail \
  --deployment l8ai-mail \
  --domain-id dom_example \
  --environment-id prod \
  --actor-type user \
  --actor-id u_001 \
  --mailbox bob@example.com \
  --query ALL \
  --mailbox-access self
```

### `mail receive-test-plan`

Plans a tagged send-and-search smoke test.

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

### `intent mail-command`

Turns natural mail requests into deterministic send or inbox-check plans.

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs intent mail-command \
  --intent send_mail \
  --namespace mail \
  --deployment l8ai-mail \
  --domain-id dom_example \
  --environment-id prod \
  --actor-type user \
  --actor-id u_001 \
  --from alice@example.com \
  --to bob@example.com \
  --subject "hello" \
  --body "Please review the report."
```

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs intent mail-command \
  --intent check_new_mail \
  --namespace mail \
  --deployment l8ai-mail \
  --domain-id dom_example \
  --environment-id prod \
  --actor-type user \
  --actor-id u_001 \
  --mailbox bob@example.com \
  --query ALL \
  --mailbox-access self
```

## Permission Commands

| Command | Purpose |
| --- | --- |
| `permission alias-plan` | Plan alias to one recipient. |
| `permission quota-plan` | Plan mailbox quota change. |
| `permission shared-mailbox-plan` | Plan shared mailbox members and send-as policy. |
| `permission distribution-group-plan` | Plan multi-recipient distribution group. |
| `permission forwarding-plan` | Plan forwarding; external forwarding blocks runtime commands until approved. |

Forwarding and delegated mailbox access require explicit audit. External
forwarding is treated as high risk because it can leak managed-domain mail.

## Security And Diagnosis

### `security dkim-plan`

Plans DKIM key generation and DNS publication instructions.

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs security dkim-plan \
  --namespace mail \
  --deployment l8ai-mail \
  --domain-id dom_example \
  --environment-id prod \
  --actor-type user \
  --actor-id admin_001 \
  --domain example.com \
  --selector default \
  --key-size 2048
```

### `diagnose inbound`

Ranks likely inbound mail failures from observed DNS state.

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs diagnose inbound \
  --domain example.com \
  --mail-hostname mail.example.com \
  --public-ip 203.0.113.10 \
  --actual-json '{"A":[],"MX":[],"SPF":[],"DKIM":[],"DMARC":[],"rDNS":[]}'
```

## Listener Commands

| Command | Purpose |
| --- | --- |
| `listener create-plan` | Define a bounded mailbox listener. |
| `listener poll-plan` | Generate read-only `doveadm` discovery commands. |
| `listener evaluate` | Filter fetched messages, de-duplicate state and emit Agent tasks. |
| `listener record-result` | Persist processed message ids to a local state file. |

See `docs/listeners.md` for the full listener workflow and guardrails.

## Ledger Commands

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs ledger append \
  --ledger-file /var/lib/doemail/operations.jsonl \
  --record-json '<operation-record-json>'

node DoSuite/DoEmail/Skill/scripts/doemail.mjs ledger list \
  --ledger-file /var/lib/doemail/operations.jsonl
```

Use the ledger as local execution evidence. Do not store secret values in the
record JSON.
