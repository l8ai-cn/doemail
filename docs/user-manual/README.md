# oilan.ai 邮箱使用手册

给 `@oilan.ai` 邮箱用户在电脑和手机上配置收信、发信的使用手册。

| 文件 | 说明 |
| --- | --- |
| `oilan-ai.zh.md` / `.html` / `.pdf` | 中文版（7 页） |
| `oilan-ai.kk.md` / `.html` / `.pdf` | 哈萨克文（西里尔字母）版（8 页） |
| `cards.json` | 手册信息卡的文案，按语言分组 |
| `card-template.html` | 信息卡样式，输出 980x572 图片 |
| `manual.css` / `template.html` | 手册排版样式和 pandoc HTML 模板 |
| `build.mjs` | 生成信息卡 PNG、HTML 和 PDF |
| `images/` | 截图和信息卡：真机截图在根目录，生成的信息卡在 `images/zh`、`images/kk` |

## 规则

手册不写密码。密码只在 `sites/oilan/accounts.json`，由维护者单独发给本人；
手册里也不列邮箱名单，用户以收到的地址为准。

## 重新生成

```bash
node docs/user-manual/build.mjs
```

需要 `pandoc` 和 Google Chrome。Chrome 不在默认位置时用 `CHROME_BIN` 指定。
