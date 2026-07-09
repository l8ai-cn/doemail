# Domain Setup Runbook

Use this runbook when a user wants to connect a domain to DoEmail.

## Inputs

- Domain: `example.com`
- Mail hostname: `mail.example.com`
- Public mail IP: `203.0.113.10`
- DKIM selector: `default`
- Postmaster mailbox: `postmaster@example.com`

## Required DNS Guidance

Show the user a table like this, replacing the placeholders with real values:

| Record | Name | Value |
| --- | --- | --- |
| `A` | `mail.example.com` | `203.0.113.10` |
| `MX` | `example.com` | `10 mail.example.com.` |
| `TXT` SPF | `example.com` | `"v=spf1 mx -all"` |
| `TXT` DKIM | `default._domainkey.example.com` | `"v=DKIM1; k=rsa; p=<dkim-public-key>"` |
| `TXT` DMARC | `_dmarc.example.com` | `"v=DMARC1; p=none; rua=mailto:postmaster@example.com"` |
| `rDNS` | `203.0.113.10` | `mail.example.com` |

Tell the user that `rDNS`/PTR is set at the IP provider. It is usually not a
normal DNS zone record.

## Verification

Run these checks from the selected doagent target:

```bash
dig +short A mail.example.com
dig +short MX example.com
dig +short TXT example.com
dig +short TXT default._domainkey.example.com
dig +short TXT _dmarc.example.com
dig +short -x 203.0.113.10
```

Expected results:

- `A` returns the public mail IP.
- `MX` returns the mail hostname.
- SPF includes `v=spf1`.
- DKIM includes `v=DKIM1`.
- DMARC includes `v=DMARC1`.
- reverse DNS returns the mail hostname.

If a check fails, report the record name, actual value and expected value.
