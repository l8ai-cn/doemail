# Mailbox Listener Runbook

DoEmail listeners let an Agent react to mailbox events without turning the mail
server into an unbounded automation loop.

The current Skill model is run-once:

1. Plan which mailbox/query to poll.
2. Fetch candidate message metadata through the selected doagent target.
3. Evaluate the messages against a listener config and previous state.
4. Emit bounded Agent task payloads.
5. Persist processed message ids only after task outcomes are recorded.

## Listener Config

Create a listener plan:

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs listener create-plan \
  --namespace mail \
  --deployment l8ai-mail \
  --domain-id dom_example \
  --environment-id prod \
  --actor-type user \
  --actor-id admin_001 \
  --listener-id support-inbox \
  --mailbox support@example.com \
  --query ALL \
  --subject-contains urgent \
  --action agent_task \
  --prompt-template "Summarize and triage this message" \
  --state-file /var/lib/doemail/listeners/support-inbox.json \
  --max-per-run 3
```

Important fields:

| Field | Meaning |
| --- | --- |
| `listener-id` | Stable id used for state and evidence. |
| `mailbox` | Mailbox to inspect. |
| `query` | Mail search query used by the poll plan. |
| `subject-contains` | Optional subject filter. |
| `action` | Currently expected to emit an `agent_task`. |
| `prompt-template` | Prompt text for the downstream Agent task. |
| `state-file` | Local state file storing processed message ids. |
| `max-per-run` | Hard cap for selected messages in one evaluation. |

## Poll Plan

Generate read-only discovery commands:

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs listener poll-plan \
  --namespace mail \
  --deployment l8ai-mail \
  --listener-id support-inbox \
  --mailbox support@example.com \
  --query ALL \
  --max-per-run 5
```

The poll plan should be executed through the selected doagent target. It should
not mutate the mailbox.

## Evaluate Messages

Pass fetched message metadata and previous state into `listener evaluate`:

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs listener evaluate \
  --listener-json '<listener-config-json>' \
  --messages-json '<message-metadata-json-array>' \
  --state-json '<listener-state-json>'
```

Expected message metadata should include stable identifiers, especially
`messageId`. The evaluator de-duplicates against previous processed ids and
returns:

- selected messages;
- generated Agent task payloads;
- blocked actions;
- next state.

## Record Results

Persist state after downstream task results are known:

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs listener record-result \
  --state-file /var/lib/doemail/listeners/support-inbox.json \
  --listener-id support-inbox \
  --processed-message-ids msg-a@example.com,msg-b@example.com
```

Do not record a message as processed before the Agent task is accepted or
finished according to the owning workflow.

## Guardrails

- Use bounded `run-once` evaluations unless a Server worker owns scheduling.
- Cap every run with `maxPerRun`.
- Store processed message ids so repeated polls do not re-trigger tasks.
- Do not let listener output directly delete mail, mutate accounts, update DNS
  or change the Kubernetes runtime.
- Listener-triggered external sending requires explicit approval and a separate
  audited send operation.
- Record mailbox, actor, listener id, state file and message ids in evidence.

## Failure Handling

| Failure | Response |
| --- | --- |
| Mailbox missing | Stop and report the mailbox and runtime target. |
| IMAPS or `doveadm` query fails | Return the command output as evidence. |
| State file missing | Treat as first run only when the listener is new. |
| Message lacks `Message-ID` | Do not process it unless another stable id is present. |
| More matches than `maxPerRun` | Process only the capped set and report remaining count. |
| Downstream Agent task fails | Do not advance processed state for that message. |

## Scheduling Boundary

This Skill does not own a daemon scheduler. A future Server worker may schedule
listeners, but that worker must define locking, retry, rate limiting, budget,
failure escalation and audit storage before continuous polling is enabled.
