#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";

import {
  classifyEmailOperation,
  createEmailOperationRecord,
} from "../Server/lib/email-policy.mjs";

const [, , group, action, ...argv] = process.argv;

try {
  const output = dispatch(group, action, parseFlags(argv));
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}

function dispatch(groupName, actionName, flags) {
  if (groupName === "intent" && actionName === "plan") {
    return createIntentPlan(flags);
  }
  if (groupName === "intent" && actionName === "mail-command") {
    return createMailCommandPlan(flags);
  }
  if (groupName === "dns" && actionName === "plan") {
    return createDnsPlan(flags);
  }
  if (groupName === "dns" && actionName === "evaluate") {
    return evaluateDns(flags);
  }
  if (groupName === "integration" && actionName === "guide") {
    return createIntegrationGuide(flags);
  }
  if (groupName === "operation" && actionName === "record") {
    return createOperationRecord(flags);
  }
  if (groupName === "k8s" && actionName === "inspect-plan") {
    return createKubernetesInspectPlan(flags);
  }
  if (groupName === "k8s" && actionName === "persistence-plan") {
    return createKubernetesPersistencePlan(flags);
  }
  if (groupName === "account" && actionName === "create-plan") {
    return createAccountCreatePlan(flags);
  }
  if (groupName === "account" && actionName === "list-plan") {
    return createAccountListPlan(flags);
  }
  if (groupName === "account" && actionName === "bulk-create-plan") {
    return createBulkAccountCreatePlan(flags);
  }
  if (groupName === "account" && actionName === "reset-password-plan") {
    return createAccountResetPasswordPlan(flags);
  }
  if (groupName === "account" && actionName === "disable-plan") {
    return createAccountDisablePlan(flags);
  }
  if (groupName === "account" && actionName === "offboard-plan") {
    return createAccountOffboardPlan(flags);
  }
  if (groupName === "account" && actionName === "manifest-validate") {
    return validateAccountManifestCommand(flags);
  }
  if (groupName === "account" && actionName === "manifest-plan") {
    return createAccountManifestPlan(flags);
  }
  if (groupName === "mail" && actionName === "send-plan") {
    return createMailSendPlan(flags);
  }
  if (groupName === "mail" && actionName === "receive-test-plan") {
    return createReceiveTestPlan(flags);
  }
  if (groupName === "mail" && actionName === "read-plan") {
    return createMailReadPlan(flags);
  }
  if (groupName === "permission" && actionName === "alias-plan") {
    return createAliasPlan(flags);
  }
  if (groupName === "permission" && actionName === "quota-plan") {
    return createQuotaPlan(flags);
  }
  if (groupName === "permission" && actionName === "shared-mailbox-plan") {
    return createSharedMailboxPlan(flags);
  }
  if (groupName === "permission" && actionName === "distribution-group-plan") {
    return createDistributionGroupPlan(flags);
  }
  if (groupName === "permission" && actionName === "forwarding-plan") {
    return createForwardingPlan(flags);
  }
  if (groupName === "security" && actionName === "dkim-plan") {
    return createDkimPlan(flags);
  }
  if (groupName === "diagnose" && actionName === "inbound") {
    return diagnoseInbound(flags);
  }
  if (groupName === "evidence" && actionName === "package") {
    return createEvidencePackage(flags);
  }
  if (groupName === "listener" && actionName === "create-plan") {
    return createListenerCreatePlan(flags);
  }
  if (groupName === "listener" && actionName === "poll-plan") {
    return createListenerPollPlan(flags);
  }
  if (groupName === "listener" && actionName === "evaluate") {
    return evaluateListener(flags);
  }
  if (groupName === "listener" && actionName === "record-result") {
    return recordListenerResult(flags);
  }
  if (groupName === "ledger" && actionName === "append") {
    return appendLedger(flags);
  }
  if (groupName === "ledger" && actionName === "list") {
    return listLedger(flags);
  }
  throw new Error(
    "Usage: doemail.mjs intent plan|mail-command, dns plan|evaluate, integration guide, operation record, k8s inspect-plan|persistence-plan, account create-plan|list-plan|bulk-create-plan|reset-password-plan|disable-plan|offboard-plan|manifest-validate|manifest-plan, mail send-plan|receive-test-plan|read-plan, permission alias-plan|quota-plan|shared-mailbox-plan|distribution-group-plan|forwarding-plan, security dkim-plan, diagnose inbound, evidence package, listener create-plan|poll-plan|evaluate|record-result, or ledger append|list",
  );
}

function createIntentPlan(flags) {
  const intent = requireFlag(flags, "intent");
  if (intent !== "onboard_department") {
    throw new Error(`Unsupported intent: ${intent}`);
  }
  const domain = safeDomain(requireFlag(flags, "domain"));
  const group = safeEmail(requireFlag(flags, "group"));
  const accounts = parseAccountsJson(requireFlag(flags, "accounts-json"));
  const recipients = accounts.map((account) => account.mailbox);

  return {
    intent,
    approvalGates: ["account_distribution", "distribution_group"],
    workflow: [
      createBulkAccountCreatePlan({
        ...flags,
        "accounts-json": JSON.stringify(accounts),
      }),
      createDistributionGroupPlan({
        ...flags,
        group,
        recipients: recipients.join(","),
        "posting-policy": flags["posting-policy"] ?? "internal-only",
      }),
      createReceiveTestPlan({
        ...flags,
        from: `postmaster@${domain}`,
        to: recipients[0],
        subject: flags.subject ?? `DoEmail onboarding smoke ${group}`,
        "mailbox-access": flags["mailbox-access"] ?? "self",
      }),
    ],
  };
}

function createMailCommandPlan(flags) {
  const intent = requireFlag(flags, "intent");
  if (intent === "send_mail") {
    const from = safeEmail(requireFlag(flags, "from"));
    const to = safeEmail(requireFlag(flags, "to"));
    const subject = safeHeaderValue(requireFlag(flags, "subject"));
    const body = safeBody(requireFlag(flags, "body"));
    const messageId = `doemail-user-${stableHex(
      [from, to, subject, body, flags["requested-at"] ?? ""].join("\u001f"),
    )}@${domainPart(from)}`;
    const messageRef = `file:///tmp/${messageId}.eml`;
    const messagePath = shellPathFromFileRef(messageRef);
    const delimiter = `DOEMAIL_${stableHex(body)}`;
    if (body.includes(delimiter)) {
      throw new Error("Message body contains the generated heredoc delimiter");
    }
    const context = runtimeContext(flags);
    const send = createMailSendPlan({
      ...flags,
      from,
      to,
      "message-ref": messageRef,
    });

    send.runtimeCommands = [
      `${kubectlExec(context)} sh -lc ${shSingleQuote(
        `cat > ${messagePath} <<'${delimiter}'\nFrom: ${from}\nTo: ${to}\nSubject: ${subject}\nMessage-ID: <${messageId}>\n\n${body}\n${delimiter}\ncat ${messagePath} | sendmail -f ${from} ${to}`,
      )}`,
    ];

    return {
      kind: "mail_command_plan",
      intent,
      messageId,
      send,
    };
  }

  if (intent === "check_new_mail") {
    return {
      kind: "mail_command_plan",
      intent,
      read: createMailReadPlan({
        ...flags,
        query: flags.query ?? "ALL",
        "mailbox-access": flags["mailbox-access"] ?? "self",
      }),
    };
  }

  throw new Error(`Unsupported mail command intent: ${intent}`);
}

function createDnsPlan(flags) {
  const domain = requireFlag(flags, "domain");
  const mailHostname = requireFlag(flags, "mail-hostname");
  const publicIp = requireFlag(flags, "public-ip");
  const dkimSelector = flags["dkim-selector"] ?? "default";
  const dkimPublicKey = flags["dkim-public-key"];
  const decision = classifyEmailOperation({
    operationType: "connect_domain",
    environment: flags.environment ?? "prod",
    domain,
    mailHostname,
    publicIp,
    dkimSelector,
    dkimPublicKey,
  });

  return {
    domain,
    mailHostname,
    publicIp,
    records: decision.requiredDnsRecords,
    verificationCommands: createDnsVerificationCommands({
      domain,
      mailHostname,
      publicIp,
      dkimSelector,
    }),
  };
}

function evaluateDns(flags) {
  const plan = createDnsPlan(flags);
  const actual = parseActualDns(flags["actual-json"]);
  const results = plan.records.map((record) =>
    evaluateRecord({
      record,
      actualValues: actual[record.type] ?? [],
      domain: plan.domain,
      mailHostname: plan.mailHostname,
      publicIp: plan.publicIp,
    }),
  );

  return {
    domain: plan.domain,
    mailHostname: plan.mailHostname,
    publicIp: plan.publicIp,
    status: results.every((result) => result.status === "ok")
      ? "aligned"
      : "misaligned",
    results,
  };
}

function createIntegrationGuide(flags) {
  const domain = safeDomain(requireFlag(flags, "domain"));
  const mailHostname = safeHostname(requireFlag(flags, "mail-hostname"));
  const smtpHost = safeHostname(flags["smtp-host"] ?? mailHostname);
  const smtpPort = safePort(flags["smtp-port"] ?? "587", "smtp-port");
  const imapHost = safeHostname(flags["imap-host"] ?? mailHostname);
  const imapPort = safePort(flags["imap-port"] ?? "993", "imap-port");
  const from = safeEmail(requireFlag(flags, "from"));
  const languages = parseLanguages(flags.languages ?? "java,python,nodejs");
  const config = {
    domain,
    mailHostname,
    smtpHost,
    smtpPort,
    imapHost,
    imapPort,
    from,
  };
  const sections = {
    kubernetes: renderIntegrationKubernetes(config),
  };
  for (const language of languages) {
    sections[language] = renderIntegrationLanguage(language, config);
  }
  const markdown = [
    `# DoEmail Integration Guide for ${domain}`,
    "",
    "This guide connects an application running on Kubernetes to DoEmail through SMTP for sending and IMAPS for mailbox reads. Keep passwords in Kubernetes Secret or an approved secret store; do not commit real passwords to git.",
    "",
    sections.kubernetes,
    ...languages.map((language) => sections[language]),
    renderIntegrationVerification(config),
  ].join("\n\n");

  return {
    kind: "integration_guide",
    domain,
    mailHostname,
    smtp: {
      host: smtpHost,
      port: smtpPort,
      startTls: smtpPort === 587,
    },
    imap: {
      host: imapHost,
      port: imapPort,
      tls: true,
    },
    from,
    languages,
    sections,
    markdown,
  };
}

function createOperationRecord(flags) {
  const operationType = requireFlag(flags, "operation-type");
  const target = {};
  for (const field of [
    "domain",
    "mail-hostname",
    "mailbox",
    "alias",
    "forward-to",
    "quota",
  ]) {
    if (flags[field] !== undefined) {
      target[toCamelCase(field)] = flags[field];
    }
  }

  return createEmailOperationRecord({
    domainId: requireFlag(flags, "domain-id"),
    environmentId: requireFlag(flags, "environment-id"),
    operationType,
    actor: {
      type: requireFlag(flags, "actor-type"),
      id: requireFlag(flags, "actor-id"),
    },
    target,
    requestedAt: flags["requested-at"],
    environment: flags.environment,
    mailboxAccess: flags["mailbox-access"],
    externalDelivery: flags["external-delivery"] === "true",
  });
}

function createKubernetesInspectPlan(flags) {
  const namespace = requireFlag(flags, "namespace");
  const deployment = requireFlag(flags, "deployment");
  const mailHostname = requireFlag(flags, "mail-hostname");
  const publicIp = requireFlag(flags, "public-ip");
  const escapedNamespace = shellWord(namespace);
  const escapedDeployment = shellWord(deployment);
  const escapedHostname = shellWord(mailHostname);
  const escapedPublicIp = shellWord(publicIp);

  return {
    readOnly: true,
    namespace,
    deployment,
    mailHostname,
    publicIp,
    commands: [
      `kubectl get ns ${escapedNamespace} --ignore-not-found`,
      `kubectl -n ${escapedNamespace} get deploy,pod,pvc -o wide`,
      `kubectl -n ${escapedNamespace} describe deploy ${escapedDeployment}`,
      `kubectl -n ${escapedNamespace} logs deploy/${escapedDeployment} --tail=100`,
      `kubectl -n ${escapedNamespace} exec deploy/${escapedDeployment} -- setup email list`,
      `kubectl -n ${escapedNamespace} exec deploy/${escapedDeployment} -- sh -lc 'ss -lntp | grep -E ":(25|465|587|993)\\\\b"'`,
      `dig +short A ${escapedHostname}`,
      `dig +short MX ${domainFromMailHostname(mailHostname)}`,
      `dig +short TXT ${domainFromMailHostname(mailHostname)}`,
      `dig +short TXT _dmarc.${domainFromMailHostname(mailHostname)}`,
      `dig +short -x ${escapedPublicIp}`,
    ],
  };
}

function createKubernetesPersistencePlan(flags) {
  const namespace = requireFlag(flags, "namespace");
  const deployment = requireFlag(flags, "deployment");
  const dataPvc = shellWord(requireFlag(flags, "data-pvc"));
  const statePvc = shellWord(requireFlag(flags, "state-pvc"));
  const configPvc = shellWord(requireFlag(flags, "config-pvc"));
  const escapedNamespace = shellWord(namespace);
  const escapedDeployment = shellWord(deployment);

  return {
    readOnly: true,
    namespace,
    deployment,
    pvcs: {
      data: dataPvc,
      state: statePvc,
      config: configPvc,
    },
    commands: [
      `kubectl -n ${escapedNamespace} get pvc ${dataPvc} ${statePvc} ${configPvc} -o wide`,
      `kubectl -n ${escapedNamespace} describe pvc ${dataPvc}`,
      `kubectl -n ${escapedNamespace} describe pvc ${statePvc}`,
      `kubectl -n ${escapedNamespace} describe pvc ${configPvc}`,
      `kubectl -n ${escapedNamespace} exec deploy/${escapedDeployment} -- df -h /var/mail /var/mail-state /tmp/docker-mailserver`,
      `kubectl -n ${escapedNamespace} exec deploy/${escapedDeployment} -- sh -lc 'test -d /var/mail && test -d /var/mail-state && test -d /tmp/docker-mailserver'`,
      `kubectl -n ${escapedNamespace} rollout history deploy/${escapedDeployment}`,
    ],
    evidence: [
      "PVCs are Bound",
      "mail data, state and config paths are mounted",
      "rollout history does not replace PVC-backed data",
    ],
  };
}

function createAccountCreatePlan(flags) {
  const mailbox = safeEmail(requireFlag(flags, "mailbox"));
  const passwordSecretRef = safeSecretRef(requireFlag(flags, "password-secret-ref"));
  const context = runtimeContext(flags);
  const operation = createEmailOperationRecord({
    ...operationContext(flags),
    operationType: "create_account",
    target: {
      mailbox,
      passwordSecretRef,
    },
  });

  return {
    operation,
    runtime: context,
    runtimeCommands: [
      `${kubectlExec(context)} setup email add ${mailbox} ${shSingleQuote(
        `<password-from:${passwordSecretRef}>`,
      )}`,
      `${kubectlExec(context)} setup email list`,
    ],
    evidence: ["account list contains mailbox", "command exit status"],
  };
}

function createAccountListPlan(flags) {
  const context = runtimeContext(flags);
  const operation = createEmailOperationRecord({
    ...operationContext(flags),
    operationType: "inspect",
    target: {
      resource: "accounts",
    },
  });

  return {
    kind: "account_list_plan",
    readOnly: true,
    operation,
    runtime: context,
    runtimeCommands: [`${kubectlExec(context)} setup email list`],
    evidence: ["account list output"],
  };
}

function createBulkAccountCreatePlan(flags) {
  const accounts = parseAccountsJson(requireFlag(flags, "accounts-json"));
  const plannedAccounts = accounts.map((account) => {
    const plan = createAccountCreatePlan({
      ...flags,
      mailbox: account.mailbox,
      "password-secret-ref": account.passwordSecretRef,
    });

    if (account.quota) {
      const quota = safeQuota(account.quota);
      plan.operation.target.quota = quota;
      plan.runtimeCommands.push(
        `${kubectlExec(plan.runtime)} setup quota set ${safeEmail(account.mailbox)} ${quota}`,
      );
      plan.evidence.push("account list shows effective quota");
    }

    return plan;
  });

  return {
    kind: "bulk_account_create_plan",
    count: plannedAccounts.length,
    accounts: plannedAccounts,
  };
}

function createAccountResetPasswordPlan(flags) {
  const mailbox = safeEmail(requireFlag(flags, "mailbox"));
  const passwordSecretRef = safeSecretRef(requireFlag(flags, "password-secret-ref"));
  const context = runtimeContext(flags);
  const operation = createEmailOperationRecord({
    ...operationContext(flags),
    operationType: "reset_password",
    target: {
      mailbox,
      passwordSecretRef,
    },
  });

  return {
    kind: "reset_password_plan",
    operation,
    runtime: context,
    runtimeCommands: [
      `${kubectlExec(context)} setup email update ${mailbox} ${shSingleQuote(
        `<password-from:${passwordSecretRef}>`,
      )}`,
      `${kubectlExec(context)} setup email list`,
    ],
    evidence: ["account update exit status", "account remains listed"],
  };
}

function createAccountDisablePlan(flags) {
  const mailbox = safeEmail(requireFlag(flags, "mailbox"));
  const context = runtimeContext(flags);
  const operation = createEmailOperationRecord({
    ...operationContext(flags),
    operationType: "disable_account",
    target: {
      mailbox,
      mode: "restrict-send-and-receive",
    },
  });

  return {
    operation,
    runtime: context,
    runtimeCommands: [
      `${kubectlExec(context)} setup email restrict add send ${mailbox}`,
      `${kubectlExec(context)} setup email restrict add receive ${mailbox}`,
      `${kubectlExec(context)} setup email restrict list send`,
      `${kubectlExec(context)} setup email restrict list receive`,
    ],
    evidence: ["send restriction contains mailbox", "receive restriction contains mailbox"],
  };
}

function createAccountOffboardPlan(flags) {
  const retention = flags.retention ?? "preserve";
  if (retention !== "preserve") {
    throw new Error("--retention currently supports preserve");
  }
  const disablePlan = createAccountDisablePlan(flags);

  return {
    kind: "offboard_account_plan",
    operation: disablePlan.operation,
    runtime: disablePlan.runtime,
    retention: {
      mode: retention,
      persistentPaths: ["/var/mail", "/var/mail-state", "/tmp/docker-mailserver"],
      deletionCommandAllowed: false,
    },
    runtimeCommands: disablePlan.runtimeCommands,
    evidence: [
      ...disablePlan.evidence,
      "mailbox data remains on PVC-backed paths",
      "no setup email del command is planned",
    ],
  };
}

function createMailSendPlan(flags) {
  const from = safeEmail(requireFlag(flags, "from"));
  const to = safeEmail(requireFlag(flags, "to"));
  const messageRef = requireFlag(flags, "message-ref");
  const context = runtimeContext(flags);
  const operation = createEmailOperationRecord({
    ...operationContext(flags),
    operationType: "send_mail",
    target: {
      from,
      to,
      messageRef,
    },
    externalDelivery: domainPart(from) !== domainPart(to),
  });

  return {
    operation,
    runtime: context,
    runtimeCommands: [
      `${kubectlExec(context)} sh -lc ${shSingleQuote(
        `cat ${shellPathFromFileRef(messageRef)} | sendmail -f ${from} ${to}`,
      )}`,
    ],
    evidence: ["sendmail exit status", "mail log tail", "recipient mailbox check"],
  };
}

function createReceiveTestPlan(flags) {
  const from = safeEmail(requireFlag(flags, "from"));
  const to = safeEmail(requireFlag(flags, "to"));
  const subject = safeHeaderValue(requireFlag(flags, "subject"));
  const messageId = `doemail-smoke-${stableHex(
    [from, to, subject, flags["requested-at"] ?? ""].join("\u001f"),
  )}@${domainPart(to)}`;
  const messageRef = `file:///tmp/${messageId}.eml`;
  const messagePath = shellPathFromFileRef(messageRef);
  const context = runtimeContext(flags);
  const send = createMailSendPlan({
    ...flags,
    from,
    to,
    "message-ref": messageRef,
  });
  const read = createMailReadPlan({
    ...flags,
    mailbox: to,
    query: `HEADER Message-ID ${messageId}`,
    "mailbox-access": flags["mailbox-access"] ?? "self",
  });

  send.runtimeCommands = [
    `${kubectlExec(context)} sh -lc ${shSingleQuote(
      `cat > ${messagePath} <<'EOF'\nFrom: ${from}\nTo: ${to}\nSubject: ${subject}\nMessage-ID: <${messageId}>\n\nDoEmail receive smoke message.\nEOF\ncat ${messagePath} | sendmail -f ${from} ${to}`,
    )}`,
  ];

  return {
    kind: "receive_test_plan",
    messageId,
    send,
    read,
    evidence: [
      "sendmail exit status",
      "mail log tail contains Message-ID",
      "recipient mailbox search returns Message-ID",
    ],
  };
}

function createMailReadPlan(flags) {
  const mailbox = safeEmail(requireFlag(flags, "mailbox"));
  const query = safeDoveadmQuery(flags.query ?? "ALL");
  const context = runtimeContext(flags);
  const operation = createEmailOperationRecord({
    ...operationContext(flags),
    operationType: "read_mail",
    target: {
      mailbox,
      query,
    },
    mailboxAccess: flags["mailbox-access"],
  });

  return {
    operation,
    runtime: context,
    runtimeCommands: [
      `${kubectlExec(context)} doveadm search -u ${mailbox} mailbox INBOX ${query}`,
    ],
    evidence: ["doveadm search result", "actor/mailbox/query audit envelope"],
  };
}

function createAliasPlan(flags) {
  const alias = safeEmail(requireFlag(flags, "alias"));
  const recipient = safeEmail(requireFlag(flags, "recipient"));
  const context = runtimeContext(flags);
  const operation = createEmailOperationRecord({
    ...operationContext(flags),
    operationType: "permission_change",
    target: {
      alias,
      recipient,
      permissionAction: "alias-add",
    },
  });

  return {
    operation,
    runtime: context,
    runtimeCommands: [
      `${kubectlExec(context)} setup alias add ${alias} ${recipient}`,
      `${kubectlExec(context)} setup alias list`,
    ],
    evidence: ["alias list contains alias and recipient"],
  };
}

function createQuotaPlan(flags) {
  const mailbox = safeEmail(requireFlag(flags, "mailbox"));
  const quota = safeQuota(requireFlag(flags, "quota"));
  const context = runtimeContext(flags);
  const operation = createEmailOperationRecord({
    ...operationContext(flags),
    operationType: "permission_change",
    target: {
      mailbox,
      quota,
      permissionAction: "quota-set",
    },
  });

  return {
    operation,
    runtime: context,
    runtimeCommands: [
      `${kubectlExec(context)} setup quota set ${mailbox} ${quota}`,
      `${kubectlExec(context)} setup email list`,
    ],
    evidence: ["account list shows effective quota"],
  };
}

function createSharedMailboxPlan(flags) {
  const mailbox = safeEmail(requireFlag(flags, "mailbox"));
  const members = parseEmailList(requireFlag(flags, "members"));
  const sendAs = flags["send-as"] ?? "denied";
  if (!["allowed", "denied"].includes(sendAs)) {
    throw new Error("--send-as must be allowed or denied");
  }
  const context = runtimeContext(flags);
  const operation = createEmailOperationRecord({
    ...operationContext(flags),
    operationType: "permission_change",
    target: {
      mailbox,
      members,
      sendAs,
      permissionAction: "shared-mailbox",
    },
  });

  return {
    kind: "shared_mailbox_plan",
    operation,
    runtime: context,
    mailbox,
    members,
    sendAs,
    runtimeCommands: [
      ...members.map(
        (member) => `${kubectlExec(context)} setup alias add ${mailbox} ${member}`,
      ),
      `${kubectlExec(context)} setup alias list`,
    ],
    evidence: [
      "alias list contains shared mailbox and each member",
      "send-as policy is captured in the approved operation envelope",
    ],
  };
}

function createDistributionGroupPlan(flags) {
  const group = safeEmail(requireFlag(flags, "group"));
  const recipients = parseEmailList(requireFlag(flags, "recipients"));
  const postingPolicy = flags["posting-policy"] ?? "internal-only";
  if (!["internal-only", "domain-public"].includes(postingPolicy)) {
    throw new Error("--posting-policy must be internal-only or domain-public");
  }
  const context = runtimeContext(flags);
  const operation = createEmailOperationRecord({
    ...operationContext(flags),
    operationType: "permission_change",
    target: {
      group,
      recipients,
      postingPolicy,
      permissionAction: "distribution-group",
    },
  });

  return {
    kind: "distribution_group_plan",
    operation,
    runtime: context,
    group,
    recipients,
    postingPolicy,
    runtimeCommands: [
      ...recipients.map(
        (recipient) => `${kubectlExec(context)} setup alias add ${group} ${recipient}`,
      ),
      `${kubectlExec(context)} setup alias list`,
    ],
    evidence: [
      "alias list contains group and each recipient",
      "posting policy is captured before apply approval",
    ],
  };
}

function createForwardingPlan(flags) {
  const mailbox = safeEmail(requireFlag(flags, "mailbox"));
  const forwardTo = safeEmail(requireFlag(flags, "forward-to"));
  const approved = flags.approved === "true";
  const externalForwarding = domainPart(mailbox) !== domainPart(forwardTo);
  const requiresExplicitApproval = externalForwarding;
  const blockedUntilApproved = requiresExplicitApproval && !approved;
  const context = runtimeContext(flags);
  const operation = createEmailOperationRecord({
    ...operationContext(flags),
    operationType: "permission_change",
    target: {
      mailbox,
      forwardTo,
      externalForwarding,
      approved,
      permissionAction: "forwarding",
    },
  });

  return {
    kind: "forwarding_plan",
    operation,
    runtime: context,
    mailbox,
    forwardTo,
    requiresExplicitApproval,
    blockedUntilApproved,
    runtimeCommands: blockedUntilApproved
      ? []
      : [
          `${kubectlExec(context)} setup alias add ${mailbox} ${forwardTo}`,
          `${kubectlExec(context)} setup alias list`,
        ],
    evidence: blockedUntilApproved
      ? ["external forwarding approval is required before runtime mutation"]
      : ["alias list contains forwarding target"],
  };
}

function createDkimPlan(flags) {
  const domain = safeDomain(requireFlag(flags, "domain"));
  const selector = safeSelector(flags.selector ?? "default");
  const keySize = safeKeySize(flags["key-size"] ?? "2048");
  const context = runtimeContext(flags);
  const operation = createEmailOperationRecord({
    ...operationContext(flags),
    operationType: "runtime_change",
    target: {
      domain,
      selector,
      keySize,
      permissionAction: "dkim-generate",
    },
  });
  const dnsRecord = {
    type: "TXT",
    name: `${selector}._domainkey.${domain}.`,
    expected: `${selector}._domainkey.${domain}. TXT "v=DKIM1; k=rsa; p=<generated-public-key>"`,
    purpose: "Publish the DKIM public key generated by the Kubernetes mail runtime.",
  };

  return {
    kind: "dkim_plan",
    operation,
    runtime: context,
    domain,
    selector,
    keySize,
    runtimeCommands: [
      `${kubectlExec(context)} setup config dkim keysize ${keySize} selector ${selector} domain ${domain}`,
      `${kubectlExec(context)} sh -lc ${shSingleQuote(
        `find /tmp/docker-mailserver/opendkim/keys/${domain} -maxdepth 2 -type f -name '*.txt' -print -exec cat {} \\;`,
      )}`,
    ],
    dnsRecord,
    evidence: [
      "runtime generated DKIM public key file",
      "DNS TXT record is published and verified with dig",
    ],
  };
}

function diagnoseInbound(flags) {
  const evaluation = evaluateDns(flags);
  const findings = evaluation.results
    .filter((result) => result.status !== "ok")
    .map((result) => ({
      type: result.type,
      name: result.name,
      status: result.status,
      expected: result.expected,
      actual: result.actual,
      impact: describeDnsImpact(result.type),
      nextAction: describeDnsNextAction(result.type),
    }));

  return {
    status: findings.length === 0 ? "healthy" : "action_required",
    domain: evaluation.domain,
    mailHostname: evaluation.mailHostname,
    publicIp: evaluation.publicIp,
    findings,
    nextActions: findings.map((finding) => finding.nextAction),
  };
}

function createEvidencePackage(flags) {
  const operation = JSON.parse(requireFlag(flags, "operation-json"));
  const verification = JSON.parse(requireFlag(flags, "verification-json"));
  validateLedgerRecord(operation);
  rejectLedgerSecrets(verification);

  return {
    operationId: operation.operationId,
    status: "evidence_ready",
    operation,
    verification: {
      commands: Array.isArray(verification.commands) ? verification.commands : [],
      results: Array.isArray(verification.results) ? verification.results : [],
    },
    summary: `${operation.operationType} evidence package for ${operation.operationId}`,
  };
}

function validateAccountManifestCommand(flags) {
  const manifest = readAccountManifest(requireFlag(flags, "accounts-file"));

  return {
    kind: "account_manifest_validation",
    valid: true,
    domainId: manifest.domainId,
    environmentId: manifest.environmentId,
    domain: manifest.domain,
    counts: countManifestAccounts(manifest.accounts),
    accounts: manifest.accounts.map((account) => ({
      mailbox: account.mailbox,
      role: account.role,
      status: account.status,
      quota: account.quota,
      passwordSecretRef: account.passwordSecretRef,
    })),
  };
}

function createAccountManifestPlan(flags) {
  const manifest = readAccountManifest(requireFlag(flags, "accounts-file"));
  const baseFlags = {
    ...flags,
    "domain-id": manifest.domainId,
    "environment-id": manifest.environmentId,
  };
  const actions = manifest.accounts.map((account) => {
    if (account.status === "disabled") {
      const plan = createAccountDisablePlan({
        ...baseFlags,
        mailbox: account.mailbox,
      });
      return accountActionFromPlan(account, "disable_account", plan);
    }

    const plan = createAccountCreatePlan({
      ...baseFlags,
      mailbox: account.mailbox,
      "password-secret-ref": account.passwordSecretRef,
    });
    if (account.quota) {
      plan.operation.target.quota = account.quota;
      plan.runtimeCommands.push(
        `${kubectlExec(plan.runtime)} setup quota set ${account.mailbox} ${account.quota}`,
      );
      plan.evidence.push("account list shows effective quota");
    }
    return accountActionFromPlan(account, "create_or_update_account", plan);
  });

  return {
    kind: "account_manifest_plan",
    manifest: {
      domainId: manifest.domainId,
      environmentId: manifest.environmentId,
      domain: manifest.domain,
      counts: countManifestAccounts(manifest.accounts),
    },
    actions,
  };
}

function accountActionFromPlan(account, action, plan) {
  return {
    action,
    mailbox: account.mailbox,
    role: account.role,
    status: account.status,
    operation: plan.operation,
    runtime: plan.runtime,
    runtimeCommands: plan.runtimeCommands,
    evidence: plan.evidence,
  };
}

function createListenerCreatePlan(flags) {
  const listener = listenerFromFlags(flags);
  const context = runtimeContext(flags);
  const operation = createEmailOperationRecord({
    ...operationContext(flags),
    operationType: "read_mail",
    target: {
      listenerId: listener.listenerId,
      mailbox: listener.mailbox,
      query: listener.query,
      action: listener.action.type,
    },
    mailboxAccess: flags["mailbox-access"] ?? "delegated",
  });

  return {
    kind: "listener_config_plan",
    operation,
    runtime: context,
    listener,
    evidence: [
      "listener configuration is validated",
      "listener state file path is explicit",
      "high-risk actions are blocked by default",
    ],
  };
}

function createListenerPollPlan(flags) {
  const listenerId = safeIdentifier(requireFlag(flags, "listener-id"));
  const mailbox = safeEmail(requireFlag(flags, "mailbox"));
  const query = safeDoveadmQuery(flags.query ?? "ALL");
  const maxPerRun = parsePositiveInt(flags["max-per-run"] ?? "10", "max-per-run");
  const context = runtimeContext(flags);

  return {
    kind: "listener_poll_plan",
    readOnly: true,
    runtime: context,
    listenerId,
    mailbox,
    query,
    maxPerRun,
    runtimeCommands: [
      `${kubectlExec(context)} doveadm search -u ${mailbox} mailbox INBOX ${query}`,
      `${kubectlExec(context)} doveadm fetch -u ${mailbox} 'uid hdr.message-id hdr.from hdr.to hdr.subject date.received text' mailbox INBOX ${query}`,
    ],
    evidence: [
      "doveadm search returns candidate UIDs",
      "doveadm fetch returns message metadata for listener evaluation",
    ],
  };
}

function evaluateListener(flags) {
  const listener = normalizeListenerConfig(
    JSON.parse(requireFlag(flags, "listener-json")),
  );
  const messages = parseMessagesJson(requireFlag(flags, "messages-json"));
  const state = parseListenerState(flags["state-json"]);
  const processed = new Set(state.processedMessageIds);
  const selectedMessages = [];
  const agentTasks = [];
  const blockedActions = [];
  const counters = {
    input: messages.length,
    duplicate: 0,
    filtered: 0,
    selected: 0,
    rateLimited: 0,
  };

  for (const message of messages) {
    const messageId = message.messageId;
    if (processed.has(messageId)) {
      counters.duplicate += 1;
      continue;
    }
    if (!listenerMatchesMessage(listener, message)) {
      counters.filtered += 1;
      continue;
    }
    if (selectedMessages.length >= listener.rateLimit.maxPerRun) {
      counters.rateLimited += 1;
      continue;
    }
    if (listenerActionBlocked(listener, message)) {
      blockedActions.push({
        listenerId: listener.listenerId,
        messageId,
        action: listener.action.type,
        reason: "external send requires explicit approval",
      });
      continue;
    }

    selectedMessages.push(message);
    counters.selected += 1;
    processed.add(messageId);
    agentTasks.push(createAgentTask(listener, message));
  }

  return {
    kind: "listener_evaluation",
    listenerId: listener.listenerId,
    mailbox: listener.mailbox,
    selectedMessages,
    agentTasks,
    blockedActions,
    counters,
    nextState: {
      listenerId: listener.listenerId,
      processedMessageIds: [...processed],
    },
  };
}

function recordListenerResult(flags) {
  const stateFile = safeStateFile(requireFlag(flags, "state-file"));
  const listenerId = safeIdentifier(requireFlag(flags, "listener-id"));
  const processedMessageIds = parseMessageIdList(
    requireFlag(flags, "processed-message-ids"),
  );
  const recorded = {
    listenerId,
    processedMessageIds,
    recordedAt: new Date().toISOString(),
  };

  mkdirSync(dirname(stateFile), { recursive: true });
  writeFileSync(stateFile, `${JSON.stringify(recorded, null, 2)}\n`, {
    mode: 0o600,
  });

  return {
    listenerId,
    stateFile,
    recorded,
  };
}

function appendLedger(flags) {
  const ledgerFile = safeLedgerFile(requireFlag(flags, "ledger-file"));
  const record = JSON.parse(requireFlag(flags, "record-json"));
  validateLedgerRecord(record);
  mkdirSync(dirname(ledgerFile), { recursive: true });
  appendFileSync(ledgerFile, `${JSON.stringify(record)}\n`, { mode: 0o600 });

  return {
    ledgerFile,
    appended: {
      operationId: record.operationId,
      operationType: record.operationType,
      requestedAt: record.requestedAt,
    },
  };
}

function listLedger(flags) {
  const ledgerFile = safeLedgerFile(requireFlag(flags, "ledger-file"));
  if (!existsSync(ledgerFile)) {
    return {
      ledgerFile,
      records: [],
    };
  }
  const records = readFileSync(ledgerFile, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  return {
    ledgerFile,
    records,
  };
}

function createDnsVerificationCommands({
  domain,
  mailHostname,
  publicIp,
  dkimSelector,
}) {
  return [
    `dig +short A ${mailHostname}`,
    `dig +short MX ${domain}`,
    `dig +short TXT ${domain}`,
    `dig +short TXT ${dkimSelector}._domainkey.${domain}`,
    `dig +short TXT _dmarc.${domain}`,
    `dig +short -x ${publicIp}`,
  ];
}

function evaluateRecord({ record, actualValues, mailHostname, publicIp }) {
  const actual = actualValues.map((value) => String(value).trim()).filter(Boolean);
  const ok = recordMatches({ type: record.type, actual, mailHostname, publicIp });

  return {
    type: record.type,
    name: record.name,
    status: ok ? "ok" : actual.length === 0 ? "missing" : "mismatch",
    expected: record.expected,
    actual,
    purpose: record.purpose,
  };
}

function recordMatches({ type, actual, mailHostname, publicIp }) {
  if (type === "A") return actual.includes(publicIp);
  if (type === "MX") {
    return actual.some((value) =>
      normalizeDnsValue(value).includes(normalizeDnsValue(mailHostname)),
    );
  }
  if (type === "SPF") {
    return actual.some((value) => /v=spf1/i.test(value) && /\bmx\b/i.test(value));
  }
  if (type === "DKIM") {
    return actual.some((value) => /v=DKIM1/i.test(value));
  }
  if (type === "DMARC") {
    return actual.some((value) => /v=DMARC1/i.test(value));
  }
  if (type === "rDNS") {
    return actual.some((value) =>
      normalizeDnsValue(value).includes(normalizeDnsValue(mailHostname)),
    );
  }
  return false;
}

function parseFlags(args) {
  const flags = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected argument: ${arg}`);
    }
    const key = arg.slice(2);
    const next = args[index + 1];
    if (next === undefined || next.startsWith("--")) {
      flags[key] = "true";
      continue;
    }
    flags[key] = next;
    index += 1;
  }
  return flags;
}

function parseActualDns(value) {
  if (!value) return {};
  const parsed = JSON.parse(value);
  const normalized = {};
  for (const [key, values] of Object.entries(parsed)) {
    normalized[key] = Array.isArray(values) ? values : [values];
  }
  return normalized;
}

function parseLanguages(value) {
  const languages = String(value)
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (languages.length === 0) {
    throw new Error("--languages must contain at least one language");
  }
  for (const language of languages) {
    if (!["java", "python", "nodejs"].includes(language)) {
      throw new Error(`Unsupported integration language: ${language}`);
    }
  }
  return [...new Set(languages)];
}

function renderIntegrationKubernetes(config) {
  return `## Kubernetes Secret and ConfigMap

Create the password as a Secret outside source control:

\`\`\`yaml
apiVersion: v1
kind: Secret
metadata:
  name: doemail-client-secret
type: Opaque
stringData:
  MAIL_USERNAME: ${config.from}
  MAIL_PASSWORD: <set-this-outside-git>
\`\`\`

Store non-secret connection settings in a ConfigMap:

\`\`\`yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: doemail-client-config
data:
  MAIL_DOMAIN: ${config.domain}
  MAIL_HOSTNAME: ${config.mailHostname}
  SMTP_HOST: ${config.smtpHost}
  SMTP_PORT: "${config.smtpPort}"
  IMAP_HOST: ${config.imapHost}
  IMAP_PORT: "${config.imapPort}"
  MAIL_FROM: ${config.from}
\`\`\`

Mount both into the workload:

\`\`\`yaml
envFrom:
  - configMapRef:
      name: doemail-client-config
  - secretRef:
      name: doemail-client-secret
\`\`\``;
}

function renderIntegrationLanguage(language, config) {
  if (language === "java") return renderJavaIntegration(config);
  if (language === "python") return renderPythonIntegration(config);
  if (language === "nodejs") return renderNodeIntegration(config);
  throw new Error(`Unsupported integration language: ${language}`);
}

function renderJavaIntegration() {
  return `## Java: Jakarta Mail

Use Jakarta Mail with SMTP STARTTLS. Read all values from environment variables injected by Kubernetes.

\`\`\`java
import jakarta.mail.Message;
import jakarta.mail.PasswordAuthentication;
import jakarta.mail.Session;
import jakarta.mail.Transport;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import java.util.Properties;

public class DoEmailSend {
  public static void main(String[] args) throws Exception {
    String username = System.getenv("MAIL_USERNAME");
    String password = System.getenv("MAIL_PASSWORD");
    Properties props = new Properties();
    props.put("mail.smtp.auth", "true");
    props.put("mail.smtp.starttls.enable", "true");
    props.put("mail.smtp.host", System.getenv("SMTP_HOST"));
    props.put("mail.smtp.port", System.getenv("SMTP_PORT"));

    Session session = Session.getInstance(props, new jakarta.mail.Authenticator() {
      protected PasswordAuthentication getPasswordAuthentication() {
        return new PasswordAuthentication(username, password);
      }
    });

    Message message = new MimeMessage(session);
    message.setFrom(new InternetAddress(System.getenv("MAIL_FROM")));
    message.setRecipients(Message.RecipientType.TO, InternetAddress.parse("user@example.com"));
    message.setSubject("DoEmail test");
    message.setText("Hello from Java through DoEmail.");
    Transport.send(message);
  }
}
\`\`\``;
}

function renderPythonIntegration() {
  return `## Python: smtplib and imaplib

Use the Python standard library for basic SMTP and IMAPS checks.

\`\`\`python
import imaplib
import os
import smtplib
from email.message import EmailMessage

username = os.environ["MAIL_USERNAME"]
password = os.environ["MAIL_PASSWORD"]

message = EmailMessage()
message["From"] = os.environ["MAIL_FROM"]
message["To"] = "user@example.com"
message["Subject"] = "DoEmail test"
message.set_content("Hello from Python through DoEmail.")

with smtplib.SMTP(os.environ["SMTP_HOST"], int(os.environ["SMTP_PORT"])) as smtp:
    smtp.starttls()
    smtp.login(username, password)
    smtp.send_message(message)

with imaplib.IMAP4_SSL(os.environ["IMAP_HOST"], int(os.environ["IMAP_PORT"])) as imap:
    imap.login(username, password)
    imap.select("INBOX")
    status, data = imap.search(None, "ALL")
    print(status, data)
\`\`\``;
}

function renderNodeIntegration() {
  return `## Node.js: nodemailer and imapflow

Use nodemailer for SMTP and imapflow for IMAPS mailbox access.

\`\`\`javascript
import nodemailer from "nodemailer";
import { ImapFlow } from "imapflow";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false,
  auth: {
    user: process.env.MAIL_USERNAME,
    pass: process.env.MAIL_PASSWORD,
  },
  requireTLS: true,
});

await transporter.sendMail({
  from: process.env.MAIL_FROM,
  to: "user@example.com",
  subject: "DoEmail test",
  text: "Hello from Node.js through DoEmail.",
});

const client = new ImapFlow({
  host: process.env.IMAP_HOST,
  port: Number(process.env.IMAP_PORT),
  secure: true,
  auth: {
    user: process.env.MAIL_USERNAME,
    pass: process.env.MAIL_PASSWORD,
  },
});

await client.connect();
const lock = await client.getMailboxLock("INBOX");
try {
  for await (const message of client.fetch("1:*", { envelope: true })) {
    console.log(message.uid, message.envelope.subject);
  }
} finally {
  lock.release();
  await client.logout();
}
\`\`\``;
}

function renderIntegrationVerification(config) {
  return `## Verification

Run these checks from the application namespace before enabling production traffic:

\`\`\`bash
nc -vz ${config.smtpHost} ${config.smtpPort}
openssl s_client -connect ${config.imapHost}:${config.imapPort} -servername ${config.imapHost} </dev/null
dig +short MX ${config.domain}
dig +short TXT ${config.domain}
dig +short TXT _dmarc.${config.domain}
\`\`\`

For external delivery, verify SPF, DKIM, DMARC and reverse DNS before promising deliverability.`;
}

function parseAccountsJson(value) {
  const accounts = JSON.parse(value);
  if (!Array.isArray(accounts) || accounts.length === 0) {
    throw new Error("--accounts-json must be a non-empty array");
  }

  return accounts.map((account, index) => {
    if (!account || typeof account !== "object") {
      throw new Error(`account[${index}] must be an object`);
    }
    return {
      mailbox: safeEmail(account.mailbox),
      passwordSecretRef: safeSecretRef(
        requireObjectValue(account, "passwordSecretRef", index),
      ),
      quota: account.quota,
    };
  });
}

function readAccountManifest(accountsFile) {
  const manifestFile = safeReadableJsonFile(accountsFile);
  const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
  rejectManifestSecrets(manifest);
  return normalizeAccountManifest(manifest);
}

function normalizeAccountManifest(manifest) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new Error("account manifest must be an object");
  }
  if (manifest.kind !== "DoEmailAccountManifest") {
    throw new Error("account manifest kind must be DoEmailAccountManifest");
  }
  if (manifest.apiVersion !== "doemail.l8ai.cn/v1") {
    throw new Error("account manifest apiVersion must be doemail.l8ai.cn/v1");
  }
  const domainId = safeIdentifier(requireManifestValue(manifest, "domainId"));
  const environmentId = safeIdentifier(requireManifestValue(manifest, "environmentId"));
  const domain = safeDomain(requireManifestValue(manifest, "domain"));
  if (!Array.isArray(manifest.accounts) || manifest.accounts.length === 0) {
    throw new Error("account manifest accounts must be a non-empty array");
  }

  return {
    kind: manifest.kind,
    apiVersion: manifest.apiVersion,
    domainId,
    environmentId,
    domain,
    accounts: manifest.accounts.map((account, index) =>
      normalizeManifestAccount(account, index, domain),
    ),
  };
}

function normalizeManifestAccount(account, index, domain) {
  if (!account || typeof account !== "object" || Array.isArray(account)) {
    throw new Error(`accounts[${index}] must be an object`);
  }
  const mailbox = safeEmail(requireManifestValue(account, "mailbox", index));
  if (domainPart(mailbox) !== domain) {
    throw new Error(`accounts[${index}].mailbox must belong to ${domain}`);
  }
  const role = safeAccountRole(account.role ?? "user", index);
  const status = safeAccountStatus(account.status ?? "active", index);
  const passwordSecretRef = safeSecretRef(
    requireManifestValue(account, "passwordSecretRef", index),
  );
  const quota = account.quota === undefined ? undefined : safeQuota(account.quota);
  const displayName =
    account.displayName === undefined
      ? undefined
      : safePlainText(account.displayName, `accounts[${index}].displayName`);

  return {
    mailbox,
    role,
    status,
    passwordSecretRef,
    quota,
    displayName,
  };
}

function requireManifestValue(object, field, index) {
  const value = object[field];
  if (value === undefined || value === "") {
    const prefix = index === undefined ? "manifest" : `accounts[${index}]`;
    throw new Error(`${prefix}.${field} is required`);
  }
  return value;
}

function countManifestAccounts(accounts) {
  const counts = {
    total: accounts.length,
    admin: 0,
    user: 0,
    service: 0,
    shared: 0,
    active: 0,
    disabled: 0,
  };
  for (const account of accounts) {
    counts[account.role] += 1;
    counts[account.status] += 1;
  }
  return counts;
}

function rejectManifestSecrets(value, path = "") {
  if (value === null || value === undefined || typeof value !== "object") {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => rejectManifestSecrets(item, `${path}[${index}]`));
    return;
  }
  for (const [key, nestedValue] of Object.entries(value)) {
    const nestedPath = path ? `${path}.${key}` : key;
    if (
      [
        "password",
        "plainPassword",
        "passwordHash",
        "privateKey",
        "token",
        "apiKey",
      ].includes(key)
    ) {
      throw new Error(`${key} must not be stored in account manifests at ${nestedPath}`);
    }
    rejectManifestSecrets(nestedValue, nestedPath);
  }
}

function listenerFromFlags(flags) {
  return normalizeListenerConfig({
    listenerId: requireFlag(flags, "listener-id"),
    mailbox: requireFlag(flags, "mailbox"),
    query: flags.query ?? "ALL",
    filters: {
      from: flags.from,
      subjectContains: flags["subject-contains"],
      since: flags.since,
    },
    action: {
      type: requireFlag(flags, "action"),
      promptTemplate: flags["prompt-template"],
      to: flags.to,
      approved: flags.approved === "true",
    },
    rateLimit: {
      maxPerRun: flags["max-per-run"] ?? "10",
    },
    approvalPolicy: {
      externalSend: flags["external-send-policy"] ?? "block",
      deleteMail: "block",
      accountMutation: "block",
      runtimeChange: "block",
    },
    stateFile: requireFlag(flags, "state-file"),
  });
}

function normalizeListenerConfig(value) {
  if (!value || typeof value !== "object") {
    throw new Error("listener config must be an object");
  }
  const filters = value.filters ?? {};
  const action = value.action ?? {};
  const rateLimit = value.rateLimit ?? {};
  const approvalPolicy = value.approvalPolicy ?? {};
  const normalizedAction = {
    type: safeListenerAction(action.type ?? "agent_task"),
    promptTemplate:
      action.promptTemplate === undefined
        ? "Process this email message"
        : safeHeaderValue(String(action.promptTemplate)),
    to: action.to === undefined ? undefined : safeEmail(action.to),
    approved: action.approved === true,
  };

  return {
    listenerId: safeIdentifier(value.listenerId),
    mailbox: safeEmail(value.mailbox),
    query: safeDoveadmQuery(value.query ?? "ALL"),
    filters: {
      from: filters.from === undefined ? undefined : safeEmail(filters.from),
      subjectContains:
        filters.subjectContains === undefined
          ? undefined
          : safeHeaderValue(String(filters.subjectContains)),
      since: filters.since === undefined ? undefined : safeTimestamp(filters.since),
    },
    action: normalizedAction,
    rateLimit: {
      maxPerRun: parsePositiveInt(rateLimit.maxPerRun ?? "10", "rateLimit.maxPerRun"),
    },
    approvalPolicy: {
      externalSend: approvalPolicy.externalSend ?? "block",
      deleteMail: "block",
      accountMutation: "block",
      runtimeChange: "block",
    },
    stateFile:
      value.stateFile === undefined ? undefined : safeStateFile(String(value.stateFile)),
  };
}

function parseMessagesJson(value) {
  const messages = JSON.parse(value);
  if (!Array.isArray(messages)) {
    throw new Error("--messages-json must be an array");
  }
  return messages.map((message, index) => normalizeMessage(message, index));
}

function normalizeMessage(message, index) {
  if (!message || typeof message !== "object") {
    throw new Error(`message[${index}] must be an object`);
  }
  return {
    uid: safePlainText(requireObjectValue(message, "uid", index), `message[${index}].uid`),
    messageId: safeMessageId(
      requireObjectValue(message, "messageId", index),
      `message[${index}].messageId`,
    ),
    from: safeEmail(requireObjectValue(message, "from", index)),
    to: safeEmail(requireObjectValue(message, "to", index)),
    subject: safeHeaderValue(requireObjectValue(message, "subject", index)),
    receivedAt: safeTimestamp(requireObjectValue(message, "receivedAt", index)),
    snippet: safePlainText(message.snippet ?? "", `message[${index}].snippet`),
  };
}

function parseListenerState(value) {
  if (!value) {
    return { processedMessageIds: [] };
  }
  const state = JSON.parse(value);
  if (!state || typeof state !== "object") {
    throw new Error("listener state must be an object");
  }
  const processedMessageIds = state.processedMessageIds ?? [];
  if (!Array.isArray(processedMessageIds)) {
    throw new Error("listener state processedMessageIds must be an array");
  }
  return {
    processedMessageIds: processedMessageIds.map((messageId) =>
      safeMessageId(messageId, "processedMessageIds"),
    ),
  };
}

function listenerMatchesMessage(listener, message) {
  if (listener.filters.from && listener.filters.from !== message.from) {
    return false;
  }
  if (
    listener.filters.subjectContains &&
    !message.subject
      .toLowerCase()
      .includes(listener.filters.subjectContains.toLowerCase())
  ) {
    return false;
  }
  if (
    listener.filters.since &&
    Date.parse(message.receivedAt) < Date.parse(listener.filters.since)
  ) {
    return false;
  }
  return true;
}

function listenerActionBlocked(listener, message) {
  if (listener.action.type !== "send_mail") {
    return false;
  }
  if (!listener.action.to) {
    return true;
  }
  const externalSend = domainPart(listener.mailbox) !== domainPart(listener.action.to);
  return (
    externalSend &&
    listener.approvalPolicy.externalSend === "block" &&
    listener.action.approved !== true
  );
}

function createAgentTask(listener, message) {
  const prompt = [
    listener.action.promptTemplate,
    "",
    `Mailbox: ${listener.mailbox}`,
    `From: ${message.from}`,
    `To: ${message.to}`,
    `Subject: ${message.subject}`,
    `Message-ID: ${message.messageId}`,
    `Received-At: ${message.receivedAt}`,
    "",
    message.snippet,
  ].join("\n");

  return {
    taskId: `emailtask_${stableHex(
      [listener.listenerId, message.messageId].join("\u001f"),
    )}`,
    type: "agent_task",
    listenerId: listener.listenerId,
    source: {
      mailbox: listener.mailbox,
      messageId: message.messageId,
      uid: message.uid,
    },
    prompt,
  };
}

function parseMessageIdList(value) {
  const messageIds = String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => safeMessageId(item, "message id"));
  if (messageIds.length === 0) {
    throw new Error("message id list must not be empty");
  }
  return messageIds;
}

function requireObjectValue(object, field, index) {
  const value = object[field];
  if (value === undefined || value === "") {
    throw new Error(`account[${index}].${field} is required`);
  }
  return value;
}

function requireFlag(flags, name) {
  const value = flags[name];
  if (value === undefined || value === "") {
    throw new Error(`--${name} is required`);
  }
  return value;
}

function operationContext(flags) {
  return {
    domainId: requireFlag(flags, "domain-id"),
    environmentId: requireFlag(flags, "environment-id"),
    actor: {
      type: requireFlag(flags, "actor-type"),
      id: requireFlag(flags, "actor-id"),
    },
    requestedAt: flags["requested-at"],
    environment: flags.environment,
  };
}

function runtimeContext(flags) {
  return {
    namespace: requireFlag(flags, "namespace"),
    deployment: requireFlag(flags, "deployment"),
  };
}

function kubectlExec(context) {
  return `kubectl -n ${shellWord(context.namespace)} exec deploy/${shellWord(
    context.deployment,
  )} --`;
}

function parseEmailList(value) {
  const emails = String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => safeEmail(item));
  if (emails.length === 0) {
    throw new Error("email list must not be empty");
  }
  return emails;
}

function safeIdentifier(value) {
  if (!/^[a-zA-Z0-9._:-]+$/.test(String(value))) {
    throw new Error(`Invalid identifier: ${value}`);
  }
  return String(value);
}

function safeListenerAction(value) {
  if (!["agent_task", "send_mail"].includes(String(value))) {
    throw new Error(`Invalid listener action: ${value}`);
  }
  return String(value);
}

function safeAccountRole(value, index) {
  if (!["admin", "user", "service", "shared"].includes(String(value))) {
    throw new Error(`accounts[${index}].role must be admin, user, service, or shared`);
  }
  return String(value);
}

function safeAccountStatus(value, index) {
  if (!["active", "disabled"].includes(String(value))) {
    throw new Error(`accounts[${index}].status must be active or disabled`);
  }
  return String(value);
}

function safeSecretRef(value) {
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[a-zA-Z0-9._/@:-]+$/.test(String(value))) {
    throw new Error(`Invalid secret reference: ${value}`);
  }
  return String(value);
}

function safeEmail(value) {
  if (!/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9.-]+$/.test(value)) {
    throw new Error(`Invalid email address: ${value}`);
  }
  return value;
}

function safeDomain(value) {
  if (!/^[a-zA-Z0-9.-]+$/.test(value) || value.startsWith(".") || value.endsWith(".")) {
    throw new Error(`Invalid domain: ${value}`);
  }
  return value.toLowerCase();
}

function safeHostname(value) {
  const normalized = safeDomain(String(value));
  if (!normalized.includes(".")) {
    throw new Error(`Invalid hostname: ${value}`);
  }
  return normalized;
}

function safeSelector(value) {
  if (!/^[a-zA-Z0-9._-]+$/.test(value)) {
    throw new Error(`Invalid DKIM selector: ${value}`);
  }
  return value;
}

function safeKeySize(value) {
  if (!["1024", "2048", "4096"].includes(String(value))) {
    throw new Error("--key-size must be 1024, 2048, or 4096");
  }
  return String(value);
}

function parsePositiveInt(value, name) {
  if (!/^[1-9][0-9]*$/.test(String(value))) {
    throw new Error(`--${name} must be a positive integer`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`--${name} is too large`);
  }
  return parsed;
}

function safePort(value, name) {
  const port = parsePositiveInt(value, name);
  if (port > 65535) {
    throw new Error(`--${name} must be 65535 or lower`);
  }
  return port;
}

function safeQuota(value) {
  if (!/^[0-9]+[KMGTP]?$/i.test(value)) {
    throw new Error(`Invalid quota: ${value}`);
  }
  return value;
}

function safeDoveadmQuery(value) {
  if (!/^[a-zA-Z0-9_.:@<> -]+$/.test(value)) {
    throw new Error(`Invalid mailbox query: ${value}`);
  }
  return value.trim();
}

function safeHeaderValue(value) {
  if (/[\r\n]/.test(value)) {
    throw new Error("Header values must not contain newlines");
  }
  return value;
}

function safeBody(value) {
  if (String(value).includes("\0")) {
    throw new Error("Message body must not contain NUL bytes");
  }
  return String(value);
}

function safePlainText(value, fieldName) {
  if (String(value).includes("\0")) {
    throw new Error(`${fieldName} must not contain NUL bytes`);
  }
  return String(value);
}

function safeMessageId(value, fieldName) {
  const normalized = String(value).trim().replace(/^<|>$/g, "");
  if (normalized === "" || /[\r\n\0]/.test(normalized)) {
    throw new Error(`${fieldName} is an invalid message id`);
  }
  return normalized;
}

function safeTimestamp(value) {
  const normalized = safePlainText(value, "timestamp");
  if (Number.isNaN(Date.parse(normalized))) {
    throw new Error(`Invalid timestamp: ${value}`);
  }
  return normalized;
}

function domainPart(email) {
  return email.split("@")[1].toLowerCase();
}

function shellPathFromFileRef(value) {
  if (!value.startsWith("file://")) {
    throw new Error("--message-ref must be a file:// reference");
  }
  const path = value.slice("file://".length);
  if (!/^\/[a-zA-Z0-9._/@:-]+$/.test(path)) {
    throw new Error(`Unsafe message file path: ${path}`);
  }
  return path;
}

function shSingleQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function stableHex(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function safeLedgerFile(value) {
  if (!value.startsWith("/") || value.includes("\0")) {
    throw new Error("--ledger-file must be an absolute path");
  }
  return value;
}

function safeStateFile(value) {
  if (!value.startsWith("/") || value.includes("\0")) {
    throw new Error("--state-file must be an absolute path");
  }
  return value;
}

function safeReadableJsonFile(value) {
  if (!value.startsWith("/") || value.includes("\0") || !value.endsWith(".json")) {
    throw new Error("--accounts-file must be an absolute .json path");
  }
  if (!existsSync(value)) {
    throw new Error(`accounts file does not exist: ${value}`);
  }
  return value;
}

function validateLedgerRecord(record) {
  if (!record || typeof record !== "object") {
    throw new Error("ledger record must be an object");
  }
  if (!record.operationId || !record.operationType || !record.audit?.captured) {
    throw new Error("ledger record must include operationId, operationType and captured audit");
  }
  rejectLedgerSecrets(record);
}

function rejectLedgerSecrets(value, path = "") {
  if (value === null || value === undefined || typeof value !== "object") {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => rejectLedgerSecrets(item, `${path}[${index}]`));
    return;
  }
  for (const [key, nestedValue] of Object.entries(value)) {
    const nestedPath = path ? `${path}.${key}` : key;
    if (["password", "passwordHash", "privateKey", "token", "apiKey"].includes(key)) {
      throw new Error(`${nestedPath} must not be stored in the ledger`);
    }
    rejectLedgerSecrets(nestedValue, nestedPath);
  }
}

function toCamelCase(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function domainFromMailHostname(mailHostname) {
  return mailHostname.split(".").slice(1).join(".");
}

function describeDnsImpact(type) {
  if (type === "A") {
    return "mail hostname does not point to the expected Kubernetes mail runtime public IP.";
  }
  if (type === "MX") {
    return "domain inbound mail is not routed to the configured mail hostname.";
  }
  if (type === "SPF") {
    return "outbound messages may fail sender-policy authentication.";
  }
  if (type === "DKIM") {
    return "messages cannot be cryptographically signed for domain authentication.";
  }
  if (type === "DMARC") {
    return "domain authentication reports and policy enforcement are incomplete.";
  }
  if (type === "rDNS") {
    return "remote providers may downgrade deliverability without reverse DNS.";
  }
  return "mail routing or authentication is misaligned.";
}

function describeDnsNextAction(type) {
  if (type === "A") {
    return "Confirm the active mail runtime public IP, then update the mail hostname A record through the approved DNS change path.";
  }
  if (type === "MX") {
    return "Point the domain MX record at the approved mail hostname.";
  }
  if (type === "SPF") {
    return "Publish or update the SPF TXT record so the MX host is authorized to send.";
  }
  if (type === "DKIM") {
    return "Generate DKIM in the mail runtime, publish the selector TXT record, then verify it with dig.";
  }
  if (type === "DMARC") {
    return "Publish the _dmarc TXT record with reporting before moving to enforcement.";
  }
  if (type === "rDNS") {
    return "Ask the IP provider to set PTR/reverse DNS to the approved mail hostname.";
  }
  return "Review the DNS evaluation result and approve the matching correction plan.";
}

function shellWord(value) {
  if (!/^[a-zA-Z0-9._:-]+$/.test(value)) {
    throw new Error(`Unsafe shell value: ${value}`);
  }
  return value;
}

function normalizeDnsValue(value) {
  return String(value).trim().replace(/\.$/, "").toLowerCase();
}
