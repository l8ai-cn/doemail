# OL/OILAN Mail Server Alignment

This page records the read-only alignment check for the current OL/OILAN mail
server that DoEmail should treat as its first server target.

## Target

```text
doops target: gw-oilan-node
gateway: doops-oilan/oilan-node
host: gpu-ampere01
mail namespace: mail
mail deployment: l8ai-mail
mail hostname: mail.l8ai.cn
public mail IP: 89.250.81.244
```

All checks below were read-only and ran through:

```bash
doops -session doemail_probe_20260705 exec --target gw-oilan-node --cmd '<read-only command>'
```

## Kubernetes Runtime State

Observed state:

- namespace `mail` is active;
- deployment `l8ai-mail` is `1/1` available;
- pod `l8ai-mail-6694bbc76c-wwpkm` is running on `gpu-ampere01`;
- pod IP is `89.250.81.244`;
- PVCs `l8ai-mail-data`, `l8ai-mail-state` and `l8ai-mail-config` are bound;
- image is `docker.io/mailserver/docker-mailserver:latest`;
- host ports `25/TCP` and `993/TCP` are declared;
- `OVERRIDE_HOSTNAME=mail.l8ai.cn`;
- `POSTMASTER_ADDRESS=postmaster@l8ai.cn`;
- `ENABLE_OPENDKIM=0`;
- `ENABLE_OPENDMARC=0`.

The runtime shape matches the FDE Kubernetes mailserver model.

## Account State

Read-only command:

```bash
kubectl -n mail exec deploy/l8ai-mail -- setup email list
```

Observed accounts:

```text
postmaster@l8ai.cn
gjq@l8ai.cn
```

## Persistence State

Read-only commands:

```bash
kubectl -n mail get pvc l8ai-mail-data l8ai-mail-state l8ai-mail-config -o wide
kubectl -n mail exec deploy/l8ai-mail -- df -h /var/mail /var/mail-state /tmp/docker-mailserver
kubectl -n mail exec deploy/l8ai-mail -- sh -lc 'test -d /var/mail && test -d /var/mail-state && test -d /tmp/docker-mailserver'
```

Observed state:

- `l8ai-mail-data` is `Bound`, capacity `20Gi`, `RWO`, storage class
  `local-path`.
- `l8ai-mail-state` is `Bound`, capacity `2Gi`, `RWO`, storage class
  `local-path`.
- `l8ai-mail-config` is `Bound`, capacity `1Gi`, `RWO`, storage class
  `local-path`.
- All three PVCs are used by pod `l8ai-mail-6694bbc76c-wwpkm`.
- The runtime paths `/var/mail`, `/var/mail-state` and
  `/tmp/docker-mailserver` exist.

Conclusion: mailbox data, runtime state and mailserver config are persisted
through Kubernetes PVCs. The current storage class is node-local, so disaster
recovery still needs a backup/export plan.

## DNS Alignment

DoEmail script command:

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs dns evaluate \
  --domain l8ai.cn \
  --mail-hostname mail.l8ai.cn \
  --public-ip 89.250.81.244 \
  --actual-json '{"A":["198.18.2.164"],"MX":["1 mail.l8ai.cn."],"SPF":["\"v=spf1 mx -all\""],"DKIM":[],"DMARC":["\"v=DMARC1; p=none; rua=mailto:postmaster@l8ai.cn\""],"rDNS":[]}'
```

Result: `misaligned`.

| Record | Status | Expected | Observed |
| --- | --- | --- | --- |
| `A` | mismatch | `mail.l8ai.cn. A 89.250.81.244` | `198.18.2.164` |
| `MX` | ok | route to `mail.l8ai.cn` | `1 mail.l8ai.cn.` |
| `SPF` | ok | `"v=spf1 mx -all"` | `"v=spf1 mx -all"` |
| `DKIM` | missing | `default._domainkey.l8ai.cn TXT "v=DKIM1; ..."` | no record |
| `DMARC` | ok | `_dmarc.l8ai.cn TXT "v=DMARC1; p=none; ..."` | present |
| `rDNS` | missing | `89.250.81.244 -> mail.l8ai.cn` | no PTR result |

## Required Alignment Before External Mail Claims

1. Update `mail.l8ai.cn` `A` record to `89.250.81.244`.
2. Enable/generate DKIM in the mail runtime, then publish the generated
   `default._domainkey.l8ai.cn` TXT record.
3. Ask the IP/cloud provider to set reverse DNS/PTR:

```text
89.250.81.244 -> mail.l8ai.cn
```

Until these are fixed, DoEmail can manage the runtime and internal mailbox
state, but should report external deliverability as not aligned.
