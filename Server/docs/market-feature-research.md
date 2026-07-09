# Email Management Product Research

This research is for deciding what DoEmail should support beyond the current
Kubernetes `docker-mailserver` runtime management surface.

## Sources Reviewed

- Microsoft 365 / Exchange Online shared mailbox documentation:
  `https://learn.microsoft.com/en-us/exchange/collaboration-exo/shared-mailboxes`
- Microsoft Purview retention documentation:
  `https://learn.microsoft.com/en-us/purview/retention`
- Google Workspace Gmail quarantine documentation:
  `https://knowledge.workspace.google.com/admin/gmail/advanced/set-up-email-quarantine`
- Google Vault documentation:
  `https://support.google.com/vault/answer/2462365`
- docker-mailserver usage documentation:
  `https://docker-mailserver.github.io/docker-mailserver/latest/usage/`
- docker-mailserver DKIM best-practice documentation:
  `https://docker-mailserver.github.io/docker-mailserver/v10.4/config/best-practices/dkim/`
- mailcow documentation:
  `https://mailcow.github.io/mailcow-docs/`
- Mailu product and admin documentation:
  `https://mailu.io/`
  `https://mailu.io/master/webadministration.html`
- cPanel spam filters and autoresponder documentation:
  `https://docs.cpanel.net/cpanel/email/spam-filters/`
  `https://docs.cpanel.net/cpanel/email/autoresponders/`
- Plesk alias and auto-reply documentation:
  `https://docs.plesk.com/en-US/obsidian/customer-guide/mail-settings/creating-mail-aliases.65701/`
  `https://docs.plesk.com/en-US/obsidian/administrator-guide/website-management/mail-settings/mail-account-settings/setting-up-autoreply.65703/`

## Common Product Capabilities

| Capability | Examples in market products | DoEmail status |
| --- | --- | --- |
| Domain onboarding | DNS, MX, SPF, DKIM, DMARC, rDNS | Implemented as DNS plan/evaluate. |
| User mailbox lifecycle | create, disable, reset password, quota | Implemented as create/disable/quota plans. |
| Bulk provisioning | import or mass-add users | Implemented as bulk-create plan. |
| Alias and forwarding | aliases, forwarders, domain aliases | Alias plan implemented; external forwarding is blocked until explicit approval. |
| Shared mailbox / group mailbox | shared mailbox, full access, send-as | Implemented as shared-mailbox plan; production apply still needs runtime-specific execution review. |
| Distribution groups | group aliases and announcements | Implemented as multi-recipient distribution-group plan with posting policy. |
| Send/receive smoke tests | delivery tests and log evidence | Implemented as send/read and receive-test plans. |
| Quarantine and spam controls | quarantines, SpamAssassin/Rspamd policies | Not implemented; needs runtime-specific policy support. |
| Auto-reply / vacation | autoresponder / out-of-office | Not implemented; likely Sieve-backed. |
| Mail filtering rules | user/global filters, Sieve | Not implemented; needs Sieve plan and tests. |
| Retention and eDiscovery | Vault, Purview retention/holds | Not implemented; needs archive/retention model. |
| Audit and operation history | admin logs, email log search | Local JSONL ledger implemented for Skill operations. |
| Migration | import users/mailboxes, IMAP migration | Not implemented. |
| Deliverability monitoring | DKIM/SPF/DMARC/rDNS, delivery logs | DNS checks and DKIM generation plan implemented. |
| Security hardening | MFA/admin roles, spam, malware, fail2ban | Runtime inspection exists; policy controls are next. |

## Recommended Next Features

1. Runtime execution for shared mailbox model:
   - mailbox address;
   - members;
   - read/manage permission;
   - send-as or send-on-behalf policy;
   - evidence of membership changes.
2. Runtime execution for distribution group model:
   - group address;
   - recipients;
   - internal-only or external-allowed flag;
   - delivery test to all recipients.
3. Forwarding policy:
   - internal forwarding allowed by default;
   - external forwarding requires explicit approval;
   - audit before/after state.
4. Sieve rules:
   - auto-reply;
   - vacation;
   - mailbox filters;
   - test with sample messages.
5. Security and deliverability:
   - DKIM runtime apply and DNS publication evidence;
   - spam/quarantine policy inspection;
   - fail2ban/rate-limit inspection;
   - DMARC report mailbox handling.
6. Retention:
   - mailbox retention class;
   - archive/export plan;
   - deletion hold plan.
7. Migration:
   - CSV account import;
   - IMAP migration plan;
   - mailbox export/import evidence.

## Boundary For Current Runtime

The current OL/OILAN runtime is `docker-mailserver`. It supports accounts,
aliases, quotas, restrictions and DKIM setup through `setup`. Shared mailbox,
eDiscovery, quarantine and Sieve workflows require explicit DoEmail product
models before they should be exposed as production mutations.
