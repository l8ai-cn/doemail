#!/usr/bin/env python3
"""Verify the restored mailboxes through public SMTP and IMAPS endpoints."""

import imaplib
import json
import smtplib
import ssl
import subprocess
import time
from email.message import EmailMessage
from email.utils import make_msgid

from prepare_accounts import original_accounts


hostname = "mail.l8ai.cn"
result = subprocess.run(
    ["kubectl", "-n", "oilan", "exec", "deployment/l8ai-mail", "-c", "mailserver", "--",
     "cat", "/tmp/docker-mailserver/ssl/mail.l8ai.cn-cert.pem"],
    check=True, capture_output=True, text=True,
)
tls = ssl.create_default_context(cadata=result.stdout)

for mailbox, password in sorted(original_accounts().items()):
    message = EmailMessage()
    message["From"] = "postmaster@l8ai.cn"
    message["To"] = mailbox
    message["Subject"] = "Oilan mail recovery verification"
    message["Message-ID"] = make_msgid(domain="l8ai.cn")
    message.set_content("Internal verification of restored SMTP delivery and IMAPS access.")
    with smtplib.SMTP(hostname, 25, timeout=15) as smtp:
        smtp.ehlo("mail.l8ai.cn")
        smtp.starttls(context=tls)
        smtp.ehlo("mail.l8ai.cn")
        refused = smtp.sendmail("", [mailbox], message.as_bytes())
        if refused:
            raise SystemExit("SMTP did not accept the managed test recipient")
    with imaplib.IMAP4_SSL(hostname, 993, ssl_context=tls, timeout=15) as inbox:
        inbox.login(mailbox, password)
        status, count = inbox.select("INBOX", readonly=True)
        if status != "OK":
            raise SystemExit("Unable to select managed INBOX")
        for attempt in range(15):
            status, matches = inbox.search(None, "HEADER", "Message-ID", str(message["Message-ID"]))
            if status == "OK" and matches[0]:
                print(json.dumps({"mailbox": mailbox, "original_password": "verified",
                                  "smtp_starttls": "verified", "imap_tls": "verified",
                                  "delivery": "verified", "message_id": str(message["Message-ID"])}))
                break
            if attempt == 14:
                raise SystemExit("Accepted SMTP message did not reach the managed INBOX")
            time.sleep(2)
            inbox.noop()

with smtplib.SMTP(hostname, 25, timeout=15) as smtp:
    smtp.ehlo("mail.l8ai.cn")
    code, _ = smtp.mail("")
    if code != 250:
        raise SystemExit("SMTP MAIL command failed during relay check")
    code, _ = smtp.rcpt("relay-check@example.net")
    if code < 500:
        raise SystemExit("Unauthenticated external relay was not rejected")
    smtp.rset()
    print(json.dumps({"unauthenticated_external_relay": "rejected", "smtp_code": code}))

try:
    with imaplib.IMAP4_SSL(hostname, 993, ssl_context=tls, timeout=15) as inbox:
        inbox.login("postmaster@l8ai.cn", "invalid-recovery-test-password")
except imaplib.IMAP4.error:
    print(json.dumps({"incorrect_password": "rejected"}))
else:
    raise SystemExit("Incorrect IMAP password was accepted")
