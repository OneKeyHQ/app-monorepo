# Keyless 服务端恢复分片删除

客服专属链接是此流程的入口。App 菜单没有删除入口。

- 测试站点使用 `https://app.onekeytest.com/keyless-deletion#invitationToken=…`。
- 生产站点使用 `https://app.onekey.so/keyless-deletion#invitationToken=…`。
- 本机使用 App 的 Web 开发服务。在运行于 3003 的 App 上打开 `http://127.0.0.1:3003/keyless-deletion#invitationToken=…`。需要启动服务时，在仓库根目录运行 `WEB_PORT=3003 yarn app:web`。

正式网页按各自站点的 App 配置连接官方 Prime。本机开发网页使用 App 原有开发环境配置。Google 和 Apple OAuth 使用 OneKey ID 的项目和独立临时会话。邀请片段刷新时保留。实测应使用客服签发的、与所选 App 环境匹配的测试邀请。

右上角语言控件使用 App 的完整语言选项、共享翻译和当前站点的 App 语言设置。切换直接更新界面并保留当前表单与操作。尚无 App 翻译键的删除专属文案暂用中文。

详情见 [Prime 接口协议](./PROTOCOL.md) 和 [验证记录](./VERIFICATION.md)。
