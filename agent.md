# DoEmail 维护规范

规则的可执行副本是 `Server/lib/site-branches.mjs` 里的 `MAINTENANCE_RULES`。改规则时同时改本文件和那份代码。`Server/lib/mail-clients.mjs` 的 `renderUserGuide()` 是 README 里“用户如何对接邮箱”一节的正文。

## 分支

`branch.main.skill-only`：main 只保存 Skill、Server 规则和通用 GitOps base，不保存某个站点的邮箱密码。

`branch.main.no-mailbox-passwords`：main 禁止提交 sites/*/accounts.json 里的明文密码，也禁止把密码写进 operation record。

`branch.l8ai.passwords`：l8ai 分支保存 l8ai.cn 的邮箱密码，文件是 sites/l8ai/accounts.json。

`branch.oilan.passwords`：oilan 分支保存 oilan.ai 的邮箱密码，文件是 sites/oilan/accounts.json。

l8ai 和 oilan 都从 main 拉出。站点运行清单也放在对应分支：l8ai.cn 用 `Server/gitops/oilan`，oilan.ai 用 `Server/gitops/oilan-ai`。

## 开户和发送账户

`account.open.writes-branch-file`：开户先把邮箱和密码写入当前站点分支的 accounts.json，再在该站点的 Deployment 上创建邮箱。

`account.send.credentials`：发送账户时从该站点 accounts.json 读取密码，把邮箱地址、密码和客户端设置寄给用户指定的收件人。

`account.operation-record.no-password-field`：operation record 不得包含 password、passwordHash、token、apiKey 或 privateKey 字段。发送邮件的正文可以包含密码。

在对应分支上执行：

```bash
node Skill/scripts/doemail.mjs account open --site oilan --mailbox user@oilan.ai
node Skill/scripts/doemail.mjs account send --site oilan --mailbox user@oilan.ai --to user@example.com
```

`l8ai` 把 `--site` 换成 `l8ai`，邮箱必须属于 `l8ai.cn`。开户命令的 JSON 不包含密码。执行时从 accounts.json 读取密码，在 `doopsTarget` 上运行 `setup email add`。发送命令的邮件正文包含密码，operation record 只记录收件人。

## 用户对接

`client.standard-imap-smtp`：用户使用标准 IMAP 993 和 SMTP 587/465 对接，不使用专有协议。

`client.mainstream`：已支持的主流客户端是 Outlook、Apple 邮件、Thunderbird、Foxmail、QQ邮箱和网易邮箱大师。

具体主机和端口写在 README 的“用户如何对接邮箱”。用户只收到自己的邮箱地址和密码，不需要进入这个仓库。

## 部署边界

`deploy.do-not-share-port-25`：l8ai.cn 占用 89.250.81.243 的 25 端口，oilan.ai 占用 89.250.81.242 的 25 端口，两个 release 不能共用同一个外部地址的 25 端口。

两个 release 都在 doops target `oilan`、namespace `oilan`。改其中一个时不要修改另一个的 externalIP、端口和账户 Secret。反向解析由 `89.250.81.0/24` 的上游 `ns.kazrena.kz` 设置，不在域名解析里添加。
