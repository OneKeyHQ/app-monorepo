# 出处和取舍

只在需要核对出处或几家规范冲突时读。核对于 2026-10-06，规范可能更新，引用前重新打开原文。

## 各家说了什么

- **Apple HIG — Writing**（developer.apple.com/design/human-interface-guidelines/writing）
  - 大小写：没有强制 Title Case，只要求为每类元素选定一种并保持一致；Title Case 偏正式，sentence case 偏随意。
  - 少用 your/my（Favorites 而非 Your Favorites）；避免 we（Unable to load content）。
  - 按钮写动作，不要卖萌（Send 而非 Let's do it!）；多步流程 Get Started → Continue/Next → Done。
  - 报错不指责、给出路，贴近问题位置；不用 oops、uh-oh；避免 Invalid name 这类机械措辞；写允许什么（Use only letters for your name）。
  - 空状态给下一步，按钮或链接；关键信息不要放在会消失的地方。
  - 设置项写开启后发生什么；给直接链接而不是描述路径。不用 Click here。
- **WWDC25 Session 404 — Make a big impact with small writing changes**
  - 四个改动：删填充词（副词/形容词、感叹词、客套）、避免重复、目的放前面、建词表（推荐词/避免词/定义）。
  - 建议大声读出来检查。
- **Vercel Web Interface Guidelines**（vercel.com/design/guidelines）
  - 产品界面标题和按钮用 Chicago Title Case，营销页 sentence case。
  - 主动语态、第二人称、尽量少的词、名词一致、具体按钮（Save API Key 而非 Continue）。
  - 计数用数字、数字和单位之间不断行空格、金额小数位一致、locale 格式化、`translate="no"`、`…` 和弯引号、需要后续输入的菜单项和加载态以 `…` 结尾、placeholder 用示例值。
  - 设计全部状态：空、稀疏、密集、错误。
- **Vercel Writing Guidelines**（github.com/vercel-labs/writing-guidelines）
  - 禁用 easy/simple/quick、very/just/really 和模糊限定词；句子 20 词以内；“by monkeys” 测试被动语态；不用比喻动词；内容由谁写都由作者负责。
- **GOV.UK — Writing for user interfaces**
  - 重要词放前面（Total cost）；通常不需要 please、please note、thank you、now。
  - sorry 只用于严重问题，校验错误不道歉；Wrong password 而非 You have entered the wrong password；全站 sentence case。
- **Ant Design 文案规范**
  - 准确、简明、一致、通俗；用「你」不用「您」；不责怪用户；统计数字用阿拉伯数字；标题、标签、提示省略不必要标点；感叹号只用于强烈情感。
- **中文文案排版指北**（github.com/sparanoid/chinese-copywriting-guidelines）
  - 中英文、中文与数字之间加空格；全角标点前后不加空格；% 和 ° 不加空格；专有名词按官方写法。

## 冲突和本 skill 的取舍

| 冲突 | 取舍 |
| --- | --- |
| 英文按钮大小写：Vercel 要求 Title Case，GOV.UK 用 sentence case，Apple 只要求一致 | 先跟项目现状；没有约定时按钮和标题 Title Case，帮助文字 sentence case |
| 「我们」：Apple 建议避免 we；Ant Design 鼓励「你」「我」对话；GOV.UK 允许服务方自称 we | 默认不用；服务方确实在做具体动作时可以用 |
| Vercel 的正面语言示例 Something went wrong—try again or contact support | 只在原因未知时用；能说清原因就说清 |
| Vercel 的 `YOUR_API_TOKEN_HERE` | 指文档和代码示例里的占位写法，不代表可以在运行时界面露出占位符 |
| 「按钮 2–4 字」和「把对象写进破坏性按钮」 | 默认 2–4 字，带对象的破坏性按钮放宽到 6 字 |
| 说明句长度：Vercel 写作规范是句子 20 词以内 | 界面说明更短，默认中文 20 字、英文 12 词左右，这是本 skill 的经验值，不是某家规范 |
| 感叹号：Ant Design 写“强烈情感” | 收窄为只用于问候和祝贺 |
| 精简与风险提示 | 钱包场景下不可撤销的后果、金额和限制条件优先于字数 |

## 关于前一版草稿的更正

- “Apple 产品界面用 Title Case”不准确，HIG 只要求一致。
- 「AI slot」应为 AI slop：注水的生成内容。变量/占位符问题是附带问题，主线是删字。
- 草稿里按钮上限写过 2–4 字和 ≤6 字两种，已统一为上面的取舍。
