#!/bin/bash
set -e

cp /tmp/docker-mailserver/support-copy.sieve /usr/lib/dovecot/sieve-global/before/support-copy.sieve
sievec /usr/lib/dovecot/sieve-global/before/support-copy.sieve

# Internal MTA relay listener for cluster-internal site mail (l8ai-mail).
# Exposed only through the ClusterIP Service oilan-ai-mail-internal and
# restricted by NetworkPolicy to the l8ai-mail pod.
if ! grep -q '^2525[[:space:]]' /etc/postfix/master.cf; then
  cat >> /etc/postfix/master.cf <<'MASTER'
2525 inet n - n - - smtpd
  -o syslog_name=postfix/relay-internal
  -o smtpd_tls_security_level=may
  -o smtpd_client_restrictions=permit_mynetworks,reject
  -o smtpd_relay_restrictions=reject_unauth_destination
  -o smtpd_recipient_restrictions=reject_unauth_destination
  -o smtpd_sender_restrictions=
  -o mynetworks=100.64.0.0/10
MASTER
fi

printf '%s\n' 'l8ai.cn smtp:[l8ai-mail-internal.oilan.svc.cluster.local]:25' > /etc/postfix/transport
chmod 0644 /etc/postfix/transport
