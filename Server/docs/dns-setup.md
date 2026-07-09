# Mail Domain DNS Setup

DoEmail must give users concrete DNS instructions before claiming that a domain
is connected.

Use `example.com`, `mail.example.com` and `203.0.113.10` as placeholders below.
The Skill must replace them with the user's domain, mail hostname and public IP.

## Required Records

| Purpose | Record | Name | Value |
| --- | --- | --- | --- |
| Mail host address | `A` | `mail.example.com` | `203.0.113.10` |
| Inbound mail routing | `MX` | `example.com` | `10 mail.example.com.` |
| Sender policy | `TXT` SPF | `example.com` | `"v=spf1 mx -all"` |
| DKIM signature key | `TXT` DKIM | `default._domainkey.example.com` | `"v=DKIM1; k=rsa; p=<dkim-public-key>"` |
| DMARC reporting | `TXT` DMARC | `_dmarc.example.com` | `"v=DMARC1; p=none; rua=mailto:postmaster@example.com"` |
| Reverse DNS | provider PTR/rDNS | `203.0.113.10` | `mail.example.com` |

## User Guidance Flow

1. Ask for the domain, mail hostname and public mail IP.
2. Print the exact record table for the user's values.
3. Explain that reverse DNS is set at the IP/cloud provider, not usually at the
   DNS zone provider.
4. Verify every record before enabling outbound delivery claims.
5. Report missing or mismatched records with expected and actual values.

## Verification Commands

```bash
dig +short A mail.example.com
dig +short MX example.com
dig +short TXT example.com
dig +short TXT default._domainkey.example.com
dig +short TXT _dmarc.example.com
dig +short -x 203.0.113.10
```

Expected output must match the required record table. DNS propagation can take
time, but DoEmail should keep reporting the concrete pending record instead of
assuming propagation has completed.

## Policy Notes

- `p=none` is the recommended first DMARC policy while observing reports.
- DKIM can be marked pending until the runtime generates a public key.
- SPF should be tightened only after the final outbound mail path is known.
- Reverse DNS is required for reliable outbound deliverability.
