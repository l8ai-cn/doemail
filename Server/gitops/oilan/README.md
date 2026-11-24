# Oilan l8ai.cn mailbox recovery

This Helm chart restores the existing receiving service on the current Oilan
Kubernetes cluster. Use DoOps target `oilan`, namespace `oilan`, release
`l8ai-mail`. The removed K3s environment and its old `mail` namespace are not
used.

The public DNS entry is `mail.l8ai.cn -> 89.250.81.243`. The Kubernetes Service
exposes SMTP 25, submission 587, SMTPS 465 and IMAPS 993 on that address. The Pod
and local-path volumes are pinned to node `192.168.0.24`. The workload uses the
Pod network interface `eth0`; it does not require a host interface name or host
networking.

TLS is loaded from the `mail-tls` Secret at `/mail-tls/tls.crt` and
`/mail-tls/tls.key`; the init container only checks that the Secret is present.
DKIM signing is enabled with the existing `l8ai.cn` key in the configuration
PVC.

The chart also deploys a ClusterIP-only `l8ai-mail-internal` Service backed by a
`2525` Postfix listener (`postfix/relay-internal`). A transport map sends
`oilan.ai` to `oilan-ai-mail-internal.oilan.svc.cluster.local:25`, so mail
between the two on-cluster mail servers does not leave through the public
MX/CGNAT path. A NetworkPolicy limits the `2525` listener to the
`oilan-ai-mail` pod while keeping the public mail ports unchanged.

The image is the upstream docker-mailserver 15.1.0 release, pinned to the digest
verified from the Docker registry on 2026-11-07. Its tag is `15.1.0`; the old
base package's `v15.1.0` reference does not exist in the registry.

## Credentials and persistence

`prepare_accounts.py` must run inside the selected Oilan Agent. It reads the
existing protected host file through the audited `nsenter` path, validates both
original mailboxes (`postmaster@l8ai.cn`, `gjq@l8ai.cn`), hashes their original
passwords and creates `oilan/l8ai-mail-accounts`. Passwords remain unchanged and
are never printed, passed as command arguments or committed. Creation fails if
the Secret already exists; it does not overwrite existing credentials.

That Secret is the account configuration authority. The init container copies
its account file to the configuration PVC on each start. Account changes must
update the Secret and restart the Deployment; edits made only with `setup email`
inside a running container will not persist across restarts.

Mailbox data, state and config use separate PVCs (20Gi, 2Gi, 1Gi), each with
Helm's `keep` policy. The chart installs `user-patches.sh` and
`postfix-main.cf` from the `l8ai-mail-runtime-config` ConfigMap on every start.

The user approved restoring reception with the existing accounts and passwords
even if old message data cannot yet be found. New PVCs do not constitute a
restoration of historical messages. Keep the original credential file and any
old storage or archives intact while continuing the historical-data search.

## Release and verification

Render and lint this chart, commit and push it, then use `doops push` with
`Server/gitops` as the source directory. The session workspace must contain the
named child directory `oilan/`; the managed Helm tool rejects `chart='.'`.
Create the account Secret with `oilan/prepare_accounts.py` before starting the
workload. Deploy through `doops ask --apply`, naming `asset_source=workspace`,
`chart=oilan`, target, release, namespace, image digest and acceptance
conditions. The managed Helm tool must run its server dry-run and return a
verified rollout; shell `kubectl apply` is not the workload release path.

Run `oilan/verify_mail.py` from the same session directory after rollout. It verifies
both original passwords over IMAPS, sends one tagged internal message to each
managed mailbox through public SMTP with STARTTLS, verifies those exact messages
in INBOX, rejects incorrect passwords and checks that unauthenticated external
relay is denied without sending an external message. Check the public ports
from a separate network as well. External outbound delivery, SPF alignment and
DKIM signing have been verified separately; PTR is still pending with the IP
provider.

## Rollback

For subsequent changes, use the previous deployed Helm revision and its pinned
Git commit. For this first recovery install, stopping the Deployment or
uninstalling only the release restores the previous unavailable-service state.
Keep all three PVCs and the separately managed account Secret. Do not delete
mailbox data during rollback or rerun account import against an existing Secret.
