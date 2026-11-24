#!/bin/bash
set -e

# Internal MTA relay listener for cluster-internal site mail (oilan-ai-mail).
# Exposed only through the ClusterIP Service l8ai-mail-internal and
# restricted by NetworkPolicy to the oilan-ai-mail pod.
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

printf '%s\n' 'oilan.ai smtp:[oilan-ai-mail-internal.oilan.svc.cluster.local]:25' > /etc/postfix/transport
chmod 0644 /etc/postfix/transport
