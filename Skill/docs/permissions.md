# Permissions Runbook

Use this runbook for aliases, forwarding, quotas and mailbox access changes.

## Grants

| Action | Required grant |
| --- | --- |
| Inspect permissions | `email.inspect` |
| Change alias | `email.permission.write` |
| Change forwarding | `email.permission.write` |
| Change quota | `email.permission.write` |
| Grant mailbox access | `email.permission.write` |
| Revoke mailbox access | `email.permission.write` |

## Change Flow

1. Confirm the mailbox or alias exists.
2. Confirm the actor has `email.permission.write`.
3. Show the before state.
4. Apply the requested change.
5. Verify the after state.
6. Return evidence with before and after values.

## Safety Notes

- Forwarding can leak mail outside the managed domain; production forwarding
  changes require approval.
- Delegated mailbox read access exposes mailbox content; always audit actor,
  mailbox and time range.
- Quota changes can affect delivery; verify the effective quota after applying.
