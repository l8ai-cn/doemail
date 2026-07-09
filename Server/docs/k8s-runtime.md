# Kubernetes Mail Runtime

DoEmail's first runtime path is Kubernetes-based.

The source reference is the FDE `l8ai-mail` deployment, which runs
`docker.io/mailserver/docker-mailserver:latest` with persistent volumes and
host-level SMTP/IMAPS ports.

## Baseline Resources

```text
namespace: <mail-namespace>
deployment: <mail-runtime-name>
image: docker.io/mailserver/docker-mailserver:<pinned-version>
storage:
  mail-data    maildir data
  mail-state   runtime state
  mail-config  docker-mailserver config
ports:
  25/tcp   SMTP inbound
  587/tcp  authenticated submission
  993/tcp  IMAPS mailbox access
```

The FDE seed deployment used `hostNetwork: true` so the workload could bind TCP
25, 587 and 993 directly on the selected node. A production DoEmail deployment must
make this node/IP choice explicit because mail DNS and reverse DNS point to that
public address.

## Required Runtime Inputs

- Mail domain, such as `example.com`.
- Mail hostname, such as `mail.example.com`.
- Public IP that receives SMTP.
- Kubernetes namespace and storage class.
- Initial postmaster mailbox.
- Certificate source.
- DKIM selector and generated public key once DKIM is enabled.

## Runtime Checks

The Skill should collect evidence with commands shaped like:

```bash
kubectl -n <mail-namespace> get pod,pvc
kubectl -n <mail-namespace> logs deploy/<mail-runtime-name> --tail=100
kubectl -n <mail-namespace> exec deploy/<mail-runtime-name> -- setup email list
ss -lntp | grep -E ':(25|993)\b'
```

SMTP and IMAPS checks:

```bash
nc -vz <mail-hostname> 25
nc -vz <mail-hostname> 587
openssl s_client -connect <mail-hostname>:993 -servername <mail-hostname> </dev/null
```

## Failure Handling

DoEmail must report the failing layer directly:

- Kubernetes workload not ready;
- PVC not bound;
- TCP 25, 587 or 993 not listening;
- DNS record missing or wrong;
- reverse DNS not configured by the IP provider;
- SMTP delivery rejected;
- IMAPS authentication failed;
- requested mailbox or permission does not exist.

DoEmail should not mask a failing mail layer with another execution path.

## GitOps Base Package

The repeatable deployment package lives at:

```text
DoSuite/DoEmail/Server/gitops/base
```

Render it before applying:

```bash
kubectl kustomize DoSuite/DoEmail/Server/gitops/base
```

It defines namespace, config, Secret example, PVCs, Service and a single
`docker-mailserver` Deployment. Replace `secret.example.yaml` with a real
environment Secret mechanism before production apply.
