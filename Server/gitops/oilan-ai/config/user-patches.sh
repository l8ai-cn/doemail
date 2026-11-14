#!/bin/bash
cp /tmp/docker-mailserver/support-copy.sieve /usr/lib/dovecot/sieve-global/before/support-copy.sieve
sievec /usr/lib/dovecot/sieve-global/before/support-copy.sieve
