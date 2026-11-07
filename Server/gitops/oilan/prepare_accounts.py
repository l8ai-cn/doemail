#!/usr/bin/env python3
"""Import the two existing Oilan passwords without exposing them in output."""

import json
import subprocess


READ_ACCOUNTS = r'''
import json
from pathlib import Path

source = Path("/home/iict/data/doops-agent-home-k3s/l8ai-mail-credentials.txt")
accounts = {}
mailbox = None
identity = {}
for line in source.read_text().splitlines():
    if "=" not in line:
        continue
    key, value = line.split("=", 1)
    key, value = key.strip(), value.strip()
    if key in ("mail_domain", "mail_hostname"):
        identity[key] = value
    elif key == "mailbox":
        mailbox = value
    elif key in ("postmaster_password", "password"):
        if mailbox not in ("postmaster@l8ai.cn", "gjq@l8ai.cn") or not value:
            raise SystemExit("Invalid mailbox credential entry")
        accounts[mailbox] = value
if identity != {"mail_domain": "l8ai.cn", "mail_hostname": "mail.l8ai.cn"}:
    raise SystemExit("Unexpected mail identity in credential source")
if set(accounts) != {"postmaster@l8ai.cn", "gjq@l8ai.cn"}:
    raise SystemExit("Both original mailbox credentials are required")
print(json.dumps(accounts))
'''


def original_accounts():
    result = subprocess.run(
        ["nsenter", "-t", "1", "-m", "-u", "-i", "-n", "--", "python3", "-c", READ_ACCOUNTS],
        check=True, capture_output=True, text=True,
    )
    return json.loads(result.stdout)


if __name__ == "__main__":
    lines = []
    for mailbox, password in sorted(original_accounts().items()):
        result = subprocess.run(
            ["openssl", "passwd", "-6", "-stdin"],
            input=password + "\n", check=True, capture_output=True, text=True,
        )
        password_hash = result.stdout.strip()
        if not password_hash.startswith("$6$"):
            raise SystemExit("SHA512-CRYPT password hashing failed")
        lines.append(mailbox + "|{SHA512-CRYPT}" + password_hash)
    secret = {
        "apiVersion": "v1", "kind": "Secret",
        "metadata": {"name": "l8ai-mail-accounts", "namespace": "oilan"},
        "type": "Opaque",
        "stringData": {"postfix-accounts.cf": "\n".join(lines) + "\n"},
    }
    subprocess.run(
        ["kubectl", "create", "-f", "-"],
        input=json.dumps(secret), check=True, text=True,
    )
    print("Imported both original mailboxes; passwords preserved; no secret values logged.")
