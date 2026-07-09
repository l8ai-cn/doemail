# Account Management Runbook

Use this runbook for mailbox account lifecycle tasks.

## Supported Tasks

- Create mailbox account.
- Disable mailbox account.
- List accounts.
- Reset account credential through a secret reference.
- Validate and plan from an account manifest file.
- Check mailbox existence and quota.

## Required Permission

Account changes require:

```text
email.account.write
```

Read-only account inspection requires:

```text
email.inspect
```

## Create Account Flow

1. Confirm the target domain is connected and DNS checks have passed.
2. Confirm the requested mailbox address belongs to the managed domain.
3. Create the account in the Kubernetes mail runtime.
4. Store credentials only in the approved secret store or return them once to
   the requesting user through the approved channel.
5. Verify the account appears in the runtime account list.
6. Return evidence: command, mailbox address, timestamp and verification output.

## Account Manifest

Use `DoEmailAccountManifest` JSON to maintain administrator, user, service and
shared mailbox accounts. The file stores account intent and `passwordSecretRef`,
not plaintext passwords.

The example file lives at:

```text
DoSuite/DoEmail/Skill/examples/accounts.manifest.example.json
```

Forbidden fields:

```text
password
plainPassword
passwordHash
privateKey
token
apiKey
```

Example:

```json
{
  "kind": "DoEmailAccountManifest",
  "apiVersion": "doemail.l8ai.cn/v1",
  "domainId": "dom_l8ai",
  "environmentId": "prod",
  "domain": "l8ai.cn",
  "accounts": [
    {
      "mailbox": "admin@l8ai.cn",
      "role": "admin",
      "status": "active",
      "passwordSecretRef": "k8s://mail/secret/admin/password",
      "quota": "2G"
    }
  ]
}
```

Validate before planning:

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs account manifest-validate \
  --accounts-file /absolute/path/accounts.json
```

Generate a runtime plan:

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs account manifest-plan \
  --namespace mail \
  --deployment l8ai-mail \
  --actor-type user \
  --actor-id admin_001 \
  --accounts-file /absolute/path/accounts.json
```

## List Account Flow

Generate a read-only list plan:

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs account list-plan \
  --namespace mail \
  --deployment l8ai-mail \
  --domain-id dom_l8ai \
  --environment-id prod \
  --actor-type user \
  --actor-id admin_001
```

## Reset Password Flow

1. Write the new password into the approved secret store.
2. Reference that secret in `--password-secret-ref`.
3. Generate the reset plan.
4. Execute only after approval.
5. Verify the account remains listed.

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs account reset-password-plan \
  --namespace mail \
  --deployment l8ai-mail \
  --domain-id dom_l8ai \
  --environment-id prod \
  --actor-type user \
  --actor-id admin_001 \
  --mailbox admin@l8ai.cn \
  --password-secret-ref k8s://mail/secret/admin/password
```

## Disable Account Flow

1. Confirm the mailbox exists.
2. Disable login and delivery according to the requested policy.
3. Preserve existing mail data unless the user explicitly requests a retention
   action.
4. Verify disabled state.
5. Return evidence.
