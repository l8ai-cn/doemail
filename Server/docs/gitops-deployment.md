# GitOps Deployment Guide

This guide explains how to use the repeatable DoEmail Kubernetes mail runtime
package in `Server/gitops/base`.

The package is intentionally environment-neutral except for placeholder mail
identity values. Do not apply it to production until the domain, public IP,
storage class and Secret mechanism are reviewed.

## Package Layout

| File | Purpose |
| --- | --- |
| `kustomization.yaml` | Renders the base package into namespace `mail`. |
| `namespace.yaml` | Creates the mail namespace. |
| `configmap.yaml` | Runtime mail identity and docker-mailserver feature flags. |
| `secret.example.yaml` | Example Secret shape; real values must not be committed. |
| `pvc.yaml` | Mail data, runtime state and config PVCs. |
| `service.yaml` | ClusterIP service for SMTP `25`, submission `587` and IMAPS `993`. |
| `deployment.yaml` | Single `docker-mailserver` workload with persistent mounts. |

## Runtime Shape

The base package deploys:

- image `docker.io/mailserver/docker-mailserver:v15.1.0`;
- `hostNetwork: true` so TCP `25`, `587` and `993` can bind on the selected
  mail node;
- PVC mount `/var/mail` for mailbox data;
- PVC mount `/var/mail-state` for runtime state;
- PVC mount `/tmp/docker-mailserver` for docker-mailserver config;
- readiness probe on IMAPS and liveness probe on SMTP.

Because `hostNetwork: true` ties the runtime to the node network, the selected
node public IP must match the domain `A`, `MX` and reverse DNS plan.

## Required Environment Decisions

Before applying the package, decide and record:

| Decision | Where it appears |
| --- | --- |
| Mail domain and hostname | `configmap.yaml`, DNS records, certificates. |
| Public mail IP | DNS `A`, reverse DNS/PTR, node placement. |
| Postmaster address | `POSTMASTER_ADDRESS` in `configmap.yaml`. |
| Password source | External Secret, SealedSecret or another approved secret mechanism. |
| Storage class and size | `pvc.yaml` or an overlay. |
| TLS certificate source | Runtime config and docker-mailserver certificate files. |
| DKIM/DMARC mode | `configmap.yaml`, DNS publication and security runbook. |

## Prepare An Overlay

Keep `base/` generic. Create an environment overlay when deploying a new server:

```text
Server/gitops/overlays/<environment>/
├─ kustomization.yaml
├─ configmap-patch.yaml
├─ pvc-patch.yaml
└─ secret.yaml, sealed-secret.yaml or external-secret.yaml
```

The overlay should patch `OVERRIDE_HOSTNAME`, `POSTMASTER_ADDRESS`, PVC sizes
and any runtime flags. It should replace `secret.example.yaml` with an approved
Secret source that does not expose real credentials in git.

## Render And Review

Always render before apply:

```bash
kubectl kustomize DoSuite/DoEmail/Server/gitops/base
```

For a real environment, render the overlay:

```bash
kubectl kustomize DoSuite/DoEmail/Server/gitops/overlays/prod
```

Review the rendered output for:

- namespace and resource names;
- `OVERRIDE_HOSTNAME`;
- postmaster address;
- `hostNetwork: true`;
- PVC names, sizes and storage class;
- absence of plaintext passwords;
- ports `25`, `587` and `993`.

## Apply Gate

Apply only after these checks are complete:

1. DNS plan exists for the domain.
2. Public IP and reverse DNS owner are confirmed.
3. Secret material is present in the approved secret store.
4. Storage is persistent and backed up according to the environment policy.
5. Operator approval names the target cluster, namespace and mail hostname.

Apply command:

```bash
kubectl apply -k DoSuite/DoEmail/Server/gitops/overlays/prod
```

Use the base path only for local dry-runs or controlled test clusters.

## Post-Apply Verification

Collect runtime evidence:

```bash
kubectl -n mail get deploy,pod,pvc,svc -o wide
kubectl -n mail rollout status deploy/l8ai-mail
kubectl -n mail exec deploy/l8ai-mail -- setup email list
kubectl -n mail exec deploy/l8ai-mail -- df -h /var/mail /var/mail-state /tmp/docker-mailserver
```

Check ports from an appropriate network location:

```bash
nc -vz mail.example.com 25
nc -vz mail.example.com 587
openssl s_client -connect mail.example.com:993 -servername mail.example.com </dev/null
```

Then verify DNS with the DoEmail CLI:

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs dns evaluate \
  --domain example.com \
  --mail-hostname mail.example.com \
  --public-ip 203.0.113.10 \
  --actual-json '<observed-dns-json>'
```

Do not claim external deliverability until `A`, `MX`, `SPF`, `DKIM`, `DMARC`
and reverse DNS are aligned.

## Rollback

For manifest mistakes, revert the GitOps change and re-apply the previous
rendered package.

Do not delete PVCs during rollback unless the retention decision explicitly says
to remove mailbox data. The mailbox data PVC is the primary mail store.

Minimum rollback evidence:

- previous git revision or rendered package identifier;
- `kubectl rollout status` result after rollback;
- PVC existence and mount checks;
- account list after rollback;
- DNS state if hostname or public IP changed.
