# Integration Guide Runbook

Use this runbook when a user asks how to connect an application to DoEmail from
Kubernetes, Java, Python or Node.js.

## Generate A Guide

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs integration guide \
  --domain l8ai.cn \
  --mail-hostname mail.l8ai.cn \
  --from no-reply@l8ai.cn \
  --languages java,python,nodejs
```

Use `--languages java`, `--languages python`, or `--languages nodejs` when the
user asks for a single stack.

The CLI defaults SMTP to `mail-hostname:587` and IMAPS to
`mail-hostname:993`. Pass `--smtp-host`, `--smtp-port`, `--imap-host` or
`--imap-port` only when the application must use different endpoints.

## Required Guidance

Always include:

- Kubernetes Secret for `MAIL_USERNAME` and `MAIL_PASSWORD`.
- Kubernetes ConfigMap for SMTP/IMAP host and port values.
- Code that reads credentials from environment variables.
- SMTP send example.
- IMAPS read/search example when the selected language supports it.
- Verification commands for SMTP, IMAPS and DNS.

Do not put real passwords in generated code, manifests, docs or logs.

## Runtime Defaults

- SMTP submission: `587` with STARTTLS.
- IMAPS: `993` with TLS.
- SMTP inbound between mail servers: `25`, not the application submission port.

For external delivery, tell the user to verify SPF, DKIM, DMARC and reverse DNS
before treating delivery as production-ready.
