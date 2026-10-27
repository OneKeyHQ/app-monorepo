# 改写示例

例子用来校准删到什么程度，不是固定模板。

## 删注水

| 位置 | 原文 | 改后 | 原因 |
| --- | --- | --- | --- |
| 按钮 | 来吧 / Let's do it | 发送 / Send | 写动作，不写态度 |
| 按钮 | 继续 / Continue | 保存 API Key / Save API Key | 具体动作优先于流程词 |
| 标题 | 您的收藏 / Your Favorites | 收藏 / Favorites | 去掉多余代词 |
| 标签 | 这是总价，包含运费 | 总价（含运费） / Total (incl. shipping) | 去掉冗余主语，保留有用信息 |
| 报错 | 我们在加载内容时遇到了一些问题 | 无法加载内容 / Unable to load content | 主语换成事情本身 |
| 报错 | 您输入的密码有误 | 密码错误 / Wrong password | 不指责 |
| 报错 | 密码太短 | 至少 8 位 / Use at least 8 characters | 写要求，给出口 |
| 报错 | Oops! Invalid name | 只能包含字母 / Use only letters | 去感叹词和 invalid，写允许什么 |
| 空状态 | 这里空空如也，快来探索吧~ | 还没有钱包。[创建钱包] | 一句原因 + 一个动作 |
| 搜索 | 哇，什么都没找到！ | 没有匹配结果。[清除筛选] | 给改条件的出口 |
| 成功 | 您已成功保存更改！ | 已保存 / Saved | 去客套和感叹 |
| 说明 | 只需轻松输入车牌号，即可快速支付停车费 | 输入车牌号支付停车费 | 去副词和形容词 |
| 说明 | Enter your phone number to get reservation updates. | To get reservation updates, enter your phone number. | 目的放前面 |
| 通知 | 标题「配送延迟」+ 正文「司机无法准时送达」 | 配送延迟 10 分钟。在 App 中查看司机位置 / Delivery delayed 10 minutes. Check the app for your driver's location. | 标题和正文不重复，补下一步 |
| placeholder | 请输入邮箱地址 | name@example.com | placeholder 只给格式 |
| 链接 | 点击这里查看 | 了解手续费 / Learn about fees | 链接文字说明去向 |

## 不能为了短而删

| 原文 | 错误精简 | 正确精简 |
| --- | --- | --- |
| 转账一旦确认无法撤回，请仔细核对收款地址和网络 | 确认转账 | 转账无法撤回。核对地址和网络 |
| 删除钱包后，没有备份助记词将无法恢复资产 | 删除钱包？ | 标题：删除钱包？ 正文：没有助记词备份将无法恢复资产 |
| 最低质押 32 ETH，解除质押需要等待约 7 天 | 开始质押 | 保留两个条件，作为按钮上方的一行说明 |

## AI 生成卡片的典型 slop

原文（模型输出）：

> 🎉 太棒了！你已经成功完成了钱包备份。为了确保你的资产安全，我们强烈建议你将助记词保存在安全的地方。现在你可以开始探索 OneKey 的强大功能了！

问题：感叹和庆祝、自我说明、重复（已完成又在叮嘱）、营销词、没有具体动作。

改后：

> 标题：已备份
> 正文：离线保存助记词
> 按钮：完成

正文把「安全的地方」换成了具体做法；实际措辞以产品已有的安全文案为准，不要凭空加新要求。

## 变量

| 错误 | 正确 |
| --- | --- |
| `"已选 " + count + " item(s)"` | `已选 {count} 项`；英文用 ICU plural |
| `开始于 {time}`，time 既填「3 月 2 日」又填「15 分钟前」 | `开始于 {date}` 和 `{relative}开始` 两个 key |
| `Defeated {0} in {1}` | `Defeated {enemy} in {level}`，中文可改序为 `在第 {level} 关击败了 {enemy}` |
| 名字为空时显示 `你好，undefined` | 回退到 `你好` |
