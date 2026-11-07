# Oilan l8ai.cn mailbox recovery

This Helm chart restores the existing receiving service on the current Oilan
Kubernetes cluster. Use DoOps target `oilan`, namespace `oilan`, release
`l8ai-mail`. The removed K3s environment and its old `mail` namespace are not
used.

The public DNS entry is `mail.l8ai.cn -> 89.250.81.243`. A Kubernetes Service
exposes SMTP 25 and IMAPS 993 on that existing address. The Pod and local-path
volumes are pinned to node `192.168.0.24`. The workload uses the Pod network
interface `eth0`; it does not require a host interface name or host networking.
SMTP submission 587 is not exposed.

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

Mailbox data, state and TLS/config use separate PVCs (20Gi, 2Gi, 1Gi), each with
Helm's `keep` policy. The init container creates a self-signed TLS certificate
with the correct DNS SAN only when no certificate/key pair exists. As with the
original service, clients must trust that certificate explicitly. A new
certificate cannot retain trust in the lost old certificate.

The user approved restoring reception with the existing accounts and passwords
even if old message data cannot yet be found. New PVCs do not constitute a
restoration of historical messages. Keep the original credential file and any
old storage or archives intact while continuing the historical-data search.

## Release and verification

Render and lint this chart, commit and push it, then push this directory into
the DoOps session workspace. Create the account Secret with the preparation
script before starting the workload. Deploy through `doops ask --apply`, naming
this workspace chart, target, release, namespace, image digest and acceptance
conditions. The managed Helm tool must run its server dry-run and return a
verified rollout; shell `kubectl apply` is not the workload release path.

Run `verify_mail.py` from the same session directory after rollout. It verifies
both original passwords over IMAPS, sends one tagged internal message to each
managed mailbox through public SMTP with STARTTLS, verifies those exact messages
in INBOX, rejects incorrect passwords and checks that unauthenticated external
relay is denied without sending an external message. Check the public ports
from a separate network as well. Do not claim external outbound deliverability:
DKIM and PTR were not part of the original receiving service.

## Rollback

For subsequent changes, use the previous deployed Helm revision and its pinned
Git commit. For this first recovery install, stopping the Deployment or
uninstalling only the release restores the previous unavailable-service state.
Keep all three PVCs and the separately managed account Secret. Do not delete
mailbox data during rollback or rerun account import against an existing Secret.
