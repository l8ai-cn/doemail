# DoEmail

DoEmail is the AI-first Kubernetes-native email product in DoSuite.

## Project Introduction

DoEmail lets users operate mail domains, accounts, permissions and mailbox
automation through conversation while keeping runtime changes behind explicit
plans and evidence. It is designed for product teams that want mail operations
to be handled by an agent, without exposing plaintext credentials or asking
operators to hand-compose every DNS, Kubernetes or mailbox command.

Its AI-first design means the assistant can turn requests such as connecting a
domain, onboarding a department, resetting a mailbox password, or watching an
inbox into structured plans, Secret references, bounded runtime commands and
auditable results.

It provides an email-native application and agent skill for connecting mail
domains, creating mailbox accounts, sending and reading mail, and managing
mailbox permissions through the DoOps gateway/doagent interaction model.

```text
DoEmail/
├─ Server/   Product model, policy, Kubernetes runtime docs and future API/UI.
└─ Skill/    Agent skill, user runbooks and future DoEmail CLI contract.
```

## 用户如何对接邮箱

邮箱提供标准 IMAP 和 SMTP。Outlook、Apple 邮件、Thunderbird、Foxmail、QQ邮箱和网易邮箱大师都用下面这一套设置，不需要专有协议。用户名填完整邮箱地址。发信必须登录，收信走 IMAP。

### l8ai.cn

| 用途 | 主机 | 端口 | 加密 |
| --- | --- | --- | --- |
| 收信 IMAP | `mail.l8ai.cn` | 993 | SSL/TLS |
| 发信 SMTP | `mail.l8ai.cn` | 587 | STARTTLS |
| 发信 SMTP | `mail.l8ai.cn` | 465 | SSL/TLS |

使用已经部署在服务器上的正式证书。

### oilan.ai

| 用途 | 主机 | 端口 | 加密 |
| --- | --- | --- | --- |
| 收信 IMAP | `mail.oilan.ai` | 993 | SSL/TLS |
| 发信 SMTP | `mail.oilan.ai` | 587 | STARTTLS |
| 发信 SMTP | `mail.oilan.ai` | 465 | SSL/TLS |

当前证书是自签名证书，第一次添加账户时要信任该邮件主机。

### 客户端里怎么填

- Outlook：文件 → 添加账户 → 高级设置 → IMAP。收件和发件服务器按上面的主机、端口和加密填写，用户名填完整邮箱地址。
- Apple 邮件：系统设置或邮件 App 里添加“其他邮件账户”，类型选 IMAP。macOS 和 iOS 使用同一组服务器。
- Thunderbird：新建账户时选手动配置。IMAP 993 SSL/TLS，SMTP 587 STARTTLS。用户名填完整邮箱地址。
- Foxmail：其他邮箱 → 手动设置。收件服务器 IMAP，发件服务器 SMTP，端口和加密按上面的表填写。
- QQ邮箱：添加其他邮箱，协议选 IMAP，不要选 QQ 邮箱自己的账号登录。服务器填本站邮件主机。
- 网易邮箱大师：添加其他邮箱，选 IMAP。收信 993 SSL/TLS，发信 587 STARTTLS 或 465 SSL/TLS。

新账户由维护者在对应分支开户后，把邮箱地址和密码单独发给用户。开户和发账户的步骤在 `agent.md`。密码不在这份说明里。

## Documentation Map

Start with the page that matches the task:

| Reader | Goal | Document |
| --- | --- | --- |
| Product or platform owner | Understand scope, boundaries and current status. | This README, `Server/docs/architecture.md`, `PROGRESS.md` |
| Kubernetes operator | Deploy or inspect a mail runtime. | `Server/docs/gitops-deployment.md`, `Server/docs/k8s-runtime.md`, `Server/gitops/README.md` |
| DNS/domain operator | Connect a mail domain. | `Server/docs/dns-setup.md`, `Skill/docs/domain-setup.md` |
| Mail administrator | Manage accounts, passwords, quotas and permissions. | `Skill/docs/account-management.md`, `Skill/docs/permissions.md` |
| Agent or Skill developer | Use the DoEmail planning CLI. | `Skill/docs/cli-reference.md`, `Skill/docs/management-testing.md` |
| Application developer | Connect Java, Python, Node.js or Kubernetes workloads. | `Skill/docs/integration-guide.md` |
| Automation owner | Configure mailbox-triggered Agent tasks. | `Skill/docs/listeners.md` |
| On-call operator | Diagnose DNS, runtime, mail or listener failures. | `Skill/docs/troubleshooting.md` |

## Quick Start

Generate DNS guidance:

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs dns plan \
  --domain example.com \
  --mail-hostname mail.example.com \
  --public-ip 203.0.113.10
```

Generate a developer integration guide:

```bash
node DoSuite/DoEmail/Skill/scripts/doemail.mjs integration guide \
  --domain example.com \
  --mail-hostname mail.example.com \
  --from no-reply@example.com \
  --languages java,python,nodejs
```

Render the Kubernetes GitOps package:

```bash
kubectl kustomize DoSuite/DoEmail/Server/gitops/base
```

Run local verification:

```bash
node DoSuite/DoEmail/Server/lib/email-policy.test.mjs
node DoSuite/DoEmail/Skill/scripts/doemail.test.mjs
```

## Product Scope

- Deploy and operate a Kubernetes mail runtime.
- Connect domains by guiding users through `A`, `MX`, `SPF`, `DKIM`, `DMARC`
  and reverse DNS setup.
- Create, disable and inspect mailbox accounts.
- Maintain account manifests with administrator/user/service mailbox metadata and
  password Secret references.
- Plan department onboarding and account offboarding workflows.
- Send test or operational email through controlled agent actions.
- Read and search mailbox content with explicit mailbox permissions.
- Watch mailbox messages with bounded listeners that emit Agent task payloads.
- Generate developer integration guides for Kubernetes workloads and
  Java/Python/Node.js SMTP/IMAP clients.
- Manage aliases, shared mailboxes, distribution groups, forwarding, mailbox
  access and quotas.
- Plan DKIM enablement, diagnose inbound DNS state and package audit evidence.
- Return command output, DNS checks, delivery checks and audit evidence.

## Interaction Model

DoEmail follows the DoOps model:

```text
User / AI conversation
  -> DoEmail Server
  -> doops-gateway
  -> selected doagent target
  -> DoEmail Skill / CLI
  -> Kubernetes mail runtime
  -> SMTP / IMAP
```

The first runtime path is Kubernetes-based and uses the FDE `l8ai-mail`
deployment as source context. The bare-metal Postfix/Dovecot script remains
reference material, not the DoEmail default runtime.

## First Implementation

The current implementation establishes:

- operation classification and audit policy in `Server/lib/email-policy.mjs`;
- Skill script planning for DNS, K8S inspection, accounts, mail and permissions
  in `Skill/scripts/doemail.mjs`;
- bulk account distribution, receive-test plans, persistence checks and local
  JSONL operation ledger support;
- intent onboarding, offboarding, shared mailbox, distribution group, external
  forwarding approval, DKIM, inbound diagnosis and evidence-package plans;
- run-once mailbox listener plans, listener evaluation, listener state recording
  and deterministic mail-command intents;
- account manifest validation/planning, account list plans and password reset
  plans that never store plaintext passwords;
- developer integration guide generation and a repeatable GitOps base package;
- Kubernetes runtime and DNS setup documentation in `Server/docs/`;
- agent-facing Skill instructions and runbooks in `Skill/`.

Verification:

```bash
node DoSuite/DoEmail/Server/lib/email-policy.test.mjs
node DoSuite/DoEmail/Skill/scripts/doemail.test.mjs
```

## Safety Boundary

The Skill CLI creates plans and evidence envelopes. It does not execute
production Kubernetes, DNS, SMTP or mailbox mutations by itself. Execute runtime
commands only through the selected doagent target, after the target, domain,
mailbox and approval state are explicit.

main 不提交邮箱密码。l8ai 和 oilan 两个分支把本站密码写在 `sites/<site>/accounts.json`。
operation record、账户 manifest 和接入指南仍然不能出现密码字段。维护规则见 `agent.md`。
