import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Executable copy of DoEmail maintenance rules.
 * agent.md must mention every id in MAINTENANCE_RULES.
 */
export const MAINTENANCE_RULES = [
  {
    id: "branch.main.skill-only",
    text: "main 只保存 Skill、Server 规则和通用 GitOps base，不保存某个站点的邮箱密码。",
  },
  {
    id: "branch.main.no-mailbox-passwords",
    text: "main 禁止提交 sites/*/accounts.json 里的明文密码，也禁止把密码写进 operation record。",
  },
  {
    id: "branch.l8ai.passwords",
    text: "l8ai 分支保存 l8ai.cn 的邮箱密码，文件是 sites/l8ai/accounts.json。",
  },
  {
    id: "branch.oilan.passwords",
    text: "oilan 分支保存 oilan.ai 的邮箱密码，文件是 sites/oilan/accounts.json。",
  },
  {
    id: "account.open.writes-branch-file",
    text: "开户先把邮箱和密码写入当前站点分支的 accounts.json，再在该站点的 Deployment 上创建邮箱。",
  },
  {
    id: "account.send.credentials",
    text: "发送账户时从该站点 accounts.json 读取密码，把邮箱地址、密码和客户端设置寄给用户指定的收件人。",
  },
  {
    id: "account.operation-record.no-password-field",
    text: "operation record 不得包含 password、passwordHash、token、apiKey 或 privateKey 字段。发送邮件的正文可以包含密码。",
  },
  {
    id: "client.standard-imap-smtp",
    text: "用户使用标准 IMAP 993 和 SMTP 587/465 对接，不使用专有协议。",
  },
  {
    id: "client.mainstream",
    text: "已支持的主流客户端是 Outlook、Apple 邮件、Thunderbird、Foxmail、QQ邮箱和网易邮箱大师。",
  },
  {
    id: "deploy.do-not-share-port-25",
    text: "l8ai.cn 占用 89.250.81.243 的 25 端口，oilan.ai 占用 89.250.81.242 的 25 端口，两个 release 不能共用同一个外部地址的 25 端口。",
  },
];

export const SITES = {
  l8ai: {
    branch: "l8ai",
    domain: "l8ai.cn",
    mailHostname: "mail.l8ai.cn",
    publicIp: "89.250.81.243",
    namespace: "oilan",
    deployment: "l8ai-mail",
    release: "l8ai-mail",
    doopsTarget: "oilan",
    accountsPath: "sites/l8ai/accounts.json",
    tls: "deployed-certificate",
  },
  oilan: {
    branch: "oilan",
    domain: "oilan.ai",
    mailHostname: "mail.oilan.ai",
    publicIp: "89.250.81.242",
    namespace: "oilan",
    deployment: "oilan-ai-mail",
    release: "oilan-ai-mail",
    doopsTarget: "oilan",
    accountsPath: "sites/oilan/accounts.json",
    tls: "deployed-certificate",
  },
};

const ROLES = new Set(["admin", "user", "service", "shared"]);

export function repoRoot() {
  return fileURLToPath(new URL("../..", import.meta.url));
}

export function requireSite(site) {
  const spec = SITES[site];
  if (!spec) {
    throw new Error(`Unknown site: ${site}. Use l8ai or oilan.`);
  }
  return spec;
}

export function accountsFileFor(site, explicitPath) {
  if (explicitPath) return explicitPath;
  return join(repoRoot(), requireSite(site).accountsPath);
}

export function loadAccounts(file) {
  if (!existsSync(file)) {
    return { schema: "doemail.site-accounts.v1", accounts: [] };
  }
  const parsed = JSON.parse(readFileSync(file, "utf8"));
  if (!Array.isArray(parsed.accounts)) {
    throw new Error(`${file} is missing accounts`);
  }
  return parsed;
}

export function openAccount({ site, mailbox, role = "user", password, accountsFile }) {
  const spec = requireSite(site);
  const address = normalizeMailbox(mailbox, spec.domain);
  const accountRole = normalizeRole(role);
  const secret = password && String(password).length > 0 ? String(password) : generatePassword();
  const file = accountsFileFor(site, accountsFile);
  const store = loadAccounts(file);
  store.schema = "doemail.site-accounts.v1";
  store.site = site;
  store.domain = spec.domain;
  const existing = store.accounts.find((item) => item.mailbox === address);
  const record = {
    mailbox: address,
    role: accountRole,
    status: "active",
    password: secret,
  };
  if (existing) {
    Object.assign(existing, record);
  } else {
    store.accounts.push(record);
  }
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 });
  chmodSync(file, 0o600);
  return {
    site,
    mailbox: address,
    role: accountRole,
    created: !existing,
    accountsFile: file,
    runtime: publicRuntime(spec),
  };
}

export function readAccountPassword(site, mailbox, accountsFile) {
  const spec = requireSite(site);
  const address = normalizeMailbox(mailbox, spec.domain);
  const file = accountsFileFor(site, accountsFile);
  if (!existsSync(file)) {
    throw new Error(`账户文件不在当前分支：${spec.accountsPath}。请切换到 ${spec.branch} 分支。`);
  }
  const account = loadAccounts(file).accounts.find((item) => item.mailbox === address);
  if (!account?.password) {
    throw new Error(`${address} 不在 ${file}`);
  }
  return { mailbox: address, password: account.password, accountsFile: file, runtime: publicRuntime(spec) };
}

export function accountMessage({ site, mailbox, password }) {
  const spec = requireSite(site);
  return [
    `邮箱：${mailbox}`,
    `密码：${password}`,
    `收信 IMAP：${spec.mailHostname}`,
    "端口：993",
    "加密：SSL/TLS",
    `发信 SMTP：${spec.mailHostname}`,
    "端口：587",
    "加密：STARTTLS",
    "也可以使用 465 端口和 SSL/TLS。",
    "用户名填完整邮箱地址。",
    spec.tls === "self-signed"
      ? "当前证书是自签名证书，第一次添加时需要信任 mail.oilan.ai。"
      : "使用服务器上已经部署的正式证书。",
  ].join("\n");
}

function publicRuntime(spec) {
  return {
    branch: spec.branch,
    domain: spec.domain,
    mailHostname: spec.mailHostname,
    publicIp: spec.publicIp,
    namespace: spec.namespace,
    deployment: spec.deployment,
    release: spec.release,
    doopsTarget: spec.doopsTarget,
    tls: spec.tls,
  };
}

function normalizeMailbox(mailbox, domain) {
  const address = String(mailbox ?? "").trim().toLowerCase();
  if (!/^[a-z0-9._+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(address)) {
    throw new Error(`Invalid mailbox: ${mailbox}`);
  }
  if (!address.endsWith(`@${domain}`)) {
    throw new Error(`${address} 不属于 ${domain}`);
  }
  return address;
}

function normalizeRole(role) {
  if (!ROLES.has(role)) {
    throw new Error("role must be admin, user, service, or shared");
  }
  return role;
}

function generatePassword() {
  return randomBytes(18).toString("base64url");
}
