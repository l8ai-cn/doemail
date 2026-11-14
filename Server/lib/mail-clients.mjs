import { SITES } from "./site-branches.mjs";

/** Mainstream clients that connect with standard IMAP and SMTP. */
export const MAIL_CLIENTS = [
  {
    id: "outlook",
    name: "Outlook",
    setup: "文件 → 添加账户 → 高级设置 → IMAP。收件和发件服务器按上面的主机、端口和加密填写，用户名填完整邮箱地址。",
  },
  {
    id: "apple-mail",
    name: "Apple 邮件",
    setup: "系统设置或邮件 App 里添加“其他邮件账户”，类型选 IMAP。macOS 和 iOS 使用同一组服务器。",
  },
  {
    id: "thunderbird",
    name: "Thunderbird",
    setup: "新建账户时选手动配置。IMAP 993 SSL/TLS，SMTP 587 STARTTLS。用户名填完整邮箱地址。",
  },
  {
    id: "foxmail",
    name: "Foxmail",
    setup: "其他邮箱 → 手动设置。收件服务器 IMAP，发件服务器 SMTP，端口和加密按上面的表填写。",
  },
  {
    id: "qq-mail",
    name: "QQ邮箱",
    setup: "添加其他邮箱，协议选 IMAP，不要选 QQ 邮箱自己的账号登录。服务器填本站邮件主机。",
  },
  {
    id: "netease-mail-master",
    name: "网易邮箱大师",
    setup: "添加其他邮箱，选 IMAP。收信 993 SSL/TLS，发信 587 STARTTLS 或 465 SSL/TLS。",
  },
];

export function clientConnection(site) {
  const spec = SITES[site];
  if (!spec) {
    throw new Error(`Unknown site: ${site}`);
  }
  return {
    site,
    domain: spec.domain,
    username: `完整邮箱地址，例如 name@${spec.domain}`,
    imap: { host: spec.mailHostname, port: 993, security: "SSL/TLS" },
    smtp: { host: spec.mailHostname, port: 587, security: "STARTTLS" },
    smtps: { host: spec.mailHostname, port: 465, security: "SSL/TLS" },
    tls: spec.tls,
    clients: MAIL_CLIENTS,
  };
}

export function renderUserGuide() {
  const blocks = Object.keys(SITES).map((site) => renderSite(clientConnection(site)));
  const clients = MAIL_CLIENTS.map((client) => `- ${client.name}：${client.setup}`).join("\n");
  return `## 用户如何对接邮箱

邮箱提供标准 IMAP 和 SMTP。Outlook、Apple 邮件、Thunderbird、Foxmail、QQ邮箱和网易邮箱大师都用下面这一套设置，不需要专有协议。用户名填完整邮箱地址。发信必须登录，收信走 IMAP。

${blocks.join("\n\n")}

### 客户端里怎么填

${clients}

新账户由维护者在对应分支开户后，把邮箱地址和密码单独发给用户。开户和发账户的步骤在 \`agent.md\`。密码不在这份说明里。`;
}

function renderSite(connection) {
  const certificate =
    connection.tls === "self-signed"
      ? "当前证书是自签名证书，第一次添加账户时要信任该邮件主机。"
      : "使用已经部署在服务器上的正式证书。";
  return `### ${connection.domain}

| 用途 | 主机 | 端口 | 加密 |
| --- | --- | --- | --- |
| 收信 IMAP | \`${connection.imap.host}\` | ${connection.imap.port} | ${connection.imap.security} |
| 发信 SMTP | \`${connection.smtp.host}\` | ${connection.smtp.port} | ${connection.smtp.security} |
| 发信 SMTP | \`${connection.smtps.host}\` | ${connection.smtps.port} | ${connection.smtps.security} |

${certificate}`;
}
