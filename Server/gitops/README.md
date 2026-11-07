# DoEmail GitOps Package

This package deploys one Kubernetes `docker-mailserver` runtime for DoEmail.

The current Oilan recovery uses the environment-specific Helm chart in
[`oilan/`](oilan/README.md), namespace `oilan`, with the existing mailboxes and
passwords. The removed K3s runtime described by the original `mail` base is no
longer the live deployment.

See `../docs/gitops-deployment.md` for the full deployment workflow, overlay
guidance, apply gate, verification and rollback notes.

## Apply

Render first:

```bash
kubectl kustomize DoSuite/DoEmail/Server/gitops/base
```

Apply only after domain, public IP, storage class and Secret values are approved:

```bash
kubectl apply -k DoSuite/DoEmail/Server/gitops/base
```

For production, prefer an environment overlay that patches `base/` and replaces
`secret.example.yaml` with an approved Secret mechanism.

## Required Edits Before Production

- Set `OVERRIDE_HOSTNAME` and `POSTMASTER_ADDRESS` in `base/configmap.yaml`.
- Replace `secret.example.yaml` with a sealed secret, external secret or
  environment-specific Secret that is not committed with real values.
- Confirm the node public IP matches DNS `A`, `MX` and reverse DNS.
- Confirm the storage class and PVC sizes match the environment.

## Verification

```bash
kubectl -n mail get deploy,pod,pvc,svc -o wide
kubectl -n mail exec deploy/l8ai-mail -- setup email list
nc -vz mail.l8ai.cn 25
nc -vz mail.l8ai.cn 587
openssl s_client -connect mail.l8ai.cn:993 -servername mail.l8ai.cn </dev/null
```
