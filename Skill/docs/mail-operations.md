# Mail Operations Runbook

Use this runbook when a user asks DoEmail to send, receive, read or search mail.

## Send Mail

Required grant:

```text
email.mail.send
```

Flow:

1. Confirm the sender mailbox exists.
2. Confirm DNS and reverse DNS status for external delivery.
3. Send the message through the controlled SMTP path.
4. Capture SMTP transcript or command output.
5. Return delivery evidence and any server rejection reason.

## Read Or Search Mail

Required grant:

```text
email.mail.read
```

Flow:

1. Confirm the actor can access the requested mailbox.
2. Search using explicit criteria such as sender, recipient, subject, time
   range or message ID.
3. Return only the requested message metadata/content.
4. Record mailbox, actor, query and timestamp in the audit envelope.

## Mail Command Intents

Use `intent mail-command` when the user asks in natural language to send mail or
check new mail. The upstream Agent should pass structured fields to the CLI.

Send example:

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
```

Check-new-mail example:

```bash
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

## Mailbox Listeners

Listeners are event-loop plans, not a mail-delivery hook. First use run-once
evaluation:

1. Fetch candidate messages with `doveadm`.
2. Evaluate them against the listener config and state.
3. Emit Agent task payloads for selected messages.
4. Persist the next state after the task result is recorded.

Required guardrails:

- Set `maxPerRun` to cap each run.
- Store processed `Message-ID` values in a state JSON file.
- Block listener-triggered external send, mail deletion, account mutation, DNS
  updates and runtime changes unless an approved operation exists.

Use `listeners.md` for the full listener workflow, state file rules and
scheduling boundary.

## Receive Mail Smoke Test

Flow:

1. Ensure the domain has valid `A`, `MX`, `SPF`, `DKIM`, `DMARC` and reverse
   DNS guidance status.
2. Send a smoke message to the mailbox from an allowed test source.
3. Verify the message appears in the mailbox.
4. Return SMTP and mailbox evidence.
