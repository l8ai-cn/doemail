# DoEmail Server

DoEmail Server is the control-plane side of the DoEmail product.

It records product policy, operation intent, permissions, Kubernetes runtime
shape and evidence requirements. The server should not bypass doagent or talk
directly to mailboxes from a browser path.

## Responsibilities

- Store mail domain, mailbox, permission and runtime metadata.
- Classify operations before execution.
- Require the correct DoEmail grants for domain, account, mail, permission and
  runtime operations.
- Preserve audit and evidence records.
- Generate user-facing DNS setup guidance.
- Route execution through doops-gateway and the selected doagent target.

## Runtime Boundary

The first runtime is Kubernetes based:

- `docker-mailserver`-style SMTP/IMAP workload;
- PVC-backed mail data, state and config;
- TCP 25 for inbound SMTP;
- TCP 587 for authenticated application submission;
- TCP 993 for IMAPS;
- DNS records and reverse DNS verified before outbound claims.

## Server Documentation

- `docs/architecture.md`: component boundary and DoOps proxy rule.
- `docs/dns-setup.md`: required `A`, `MX`, `SPF`, `DKIM`, `DMARC` and rDNS
  records.
- `docs/k8s-runtime.md`: Kubernetes runtime shape and read-only checks.
- `docs/gitops-deployment.md`: repeatable deployment package workflow,
  environment overlays, apply gate and rollback.
- `docs/ol-oilan-alignment.md`: read-only alignment evidence for the current
  OL/OILAN mail server.
- `docs/market-feature-research.md`: market capability comparison and next
  feature recommendations.
- `docs/implementation-plan.md`: phased product delivery plan.

## Verification

```bash
node DoSuite/DoEmail/Server/lib/email-policy.test.mjs
```
