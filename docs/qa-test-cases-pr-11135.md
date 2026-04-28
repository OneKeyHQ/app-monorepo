# QA 测试用例 - PR #11135

## CLI 硬件钱包登录功能

**PR 链接**: https://github.com/OneKeyHQ/app-monorepo/pull/11135

**功能概述**:
本次更新为 OneKey CLI 添加硬件钱包支持：
- `onekey auth login --hardware` - 硬件钱包登录
- `onekey device <子命令>` - 设备生命周期管理命令
- 基于会话的签名器自动调度
- 共享 EVM 签名核心模块

---

## 一、硬件钱包登录 (`auth login --hardware`)

| # | 测试场景 | 前置条件 | 操作步骤 | 预期结果 |
|---|---------|---------|---------|---------|
| 1 | 设备解锁状态，密码短语关闭 | 设备已解锁，未启用 passphrase | 执行 `onekey auth login --hardware` | 显示模式选择，选择 1 后打印地址；session 显示 `passphrase_mode: 'none'`，keychain 无密码条目 |
| 2 | 设备解锁状态，密码短语开启（主机输入） | 设备已解锁，已启用 passphrase | 执行 `--hardware` 选择选项 2 | pinentry 对话框打开；密码不出现在 stdout/stderr/history；session 显示 `passphrase_mode: 'on_host'`；keychain 存储 passphrase-state + session-id |
| 3 | 设备解锁状态，密码短语开启（设备输入） | 设备已解锁，已启用 passphrase | 执行 `--hardware` 选择选项 3 | 设备屏幕提示输入；终端显示 `Please enter passphrase on device screen...`；session 显示 `passphrase_mode: 'on_device'` |
| 4 | 设备锁定状态登录 | 设备已锁定 | 执行 `onekey auth login --hardware` | CLI 打印 `Device is locked. Please enter PIN on device...`，等待 `deviceUnlock`，然后继续 |
| 5 | 同时使用两个登录参数 | 无 | 执行 `onekey auth login --hardware --app-transfer` | 退出并显示 `PARAM_MISSING_REQUIRED`，消息 `--app-transfer and --hardware are mutually exclusive.` |
| 6 | 不指定登录方式 | 无 | 执行 `onekey auth login`（无参数） | 退出并显示 `PARAM_MISSING_REQUIRED`，消息 `Login method required. Use --app-transfer or --hardware.` |
| 7 | 已登录状态重复登录 | 已通过任一方式登录 | 执行 `onekey auth login --hardware` | 退出并显示 `AUTH_WALLET_EXISTS`，建议 `Run: onekey auth logout` |
| 8 | 非 TTY 环境登录 | 非交互式 shell | 执行硬件登录 | 模式 1/3 成功；模式 2 失败（pinentry 需要 TTY）——错误清晰显示，session 未部分写入 |
| 9 | 中途取消密码输入 | 选择模式 2 | 在 pinentry 中取消 | 登录中止；`session.json` 未修改；keychain 条目未修改；退出码非零 |

---

## 二、钱包命令会话复用

| # | 测试场景 | 前置条件 | 操作步骤 | 预期结果 |
|---|---------|---------|---------|---------|
| 10 | 模式 2 登录后查余额 | 已通过模式 2 登录 | 执行 `onekey balance --chain eth` | 无密码提示；`preloadSessionCache` 预填充，SDK 发送 `session_id`，地址静默解析 |
| 11 | 模式 3 登录后查余额 | 已通过模式 3 登录 | 执行 `onekey balance --chain eth` | 同 #10；设备通过 `session_id` 识别之前的密码短语 |
| 12 | 模式 1 登录后查余额 | 已通过模式 1 登录 | 执行 `onekey balance --chain eth` | `useEmptyPassphrase: true`，无提示 |
| 13 | 硬件钱包转账 | 任意硬件模式已登录 | 执行 `onekey transfer --to 0x… --amount 0.001 --chain eth` | 本地构建交易 → 设备确认 → 交易广播，返回哈希 |
| 14 | 转账时设备拒绝 | 已登录 | 执行转账，在设备上拒绝 | 设备端取消显示；交易未广播；会话保持有效 |
| 15 | Swap 交易 | 已登录 | 执行 `onekey swap build` + `onekey swap execute --order <id>` | 与 #13 相同；execute 步骤需设备确认 |
| 16 | 查看交易历史 | 已登录 | 执行 `onekey wallet history --chain eth` | 纯只读操作——从 session 获取地址，无设备交互 |
| 17 | 命令间手动锁定设备 | 已登录，中途锁定设备 | 执行 `onekey balance --chain eth` | 检测到 `deviceWasLocked`；跳过 keychain 快捷方式；重新运行 pinentry（模式 2）或设备提示（模式 3）；keychain 重写；下次命令恢复零提示 |
| 18 | 主机重启后执行命令 | SDK 缓存为空，已登录过 | 重启后执行任意钱包命令 | Keychain 中的 `session_id` 在设备上仍有效 → `preloadSessionCache` 使 SDK 的 `Initialize` 接受它 → 零提示 |

---

## 三、设备管理命令 (`onekey device *`)

| # | 测试场景 | 前置条件 | 操作步骤 | 预期结果 |
|---|---------|---------|---------|---------|
| 19 | 搜索已连接设备 | 一台设备已连接 | 执行 `onekey device search` | 返回 `connectId`、`deviceId`、`deviceLabel`、`firmware`、`unlocked`、`passphrase_protection` |
| 20 | 搜索无设备 | 无设备连接 | 执行 `onekey device search` | 退出并显示 device-not-found；无重试循环 |
| 21 | 验证正品设备 | 正品设备已连接 | 执行 `onekey device verify` | 返回 `verified: true` 及 SDK 负载。挑战使用 `crypto.randomBytes(32)`，非 `Math.random()` |
| 22 | 验证非正品响应 | 非正品设备 | 执行 `onekey device verify` | 显示 SDK 失败信息；退出码非零 |
| 23 | 锁定设备 | 设备已解锁 | 执行 `onekey device lock` | 设备锁定；后续 `device search` 显示 `unlocked: false` |
| 24 | 查看固件版本 | 设备已连接 | 执行 `onekey device firmware` | 返回已安装版本 + 可用版本 |
| 25 | 更改 PIN 码 | 设备已连接 | 执行 `onekey device change-pin` | 设备提示输入新 PIN；`useEmptyPassphrase: true` 意味着无密码短语重新输入 |
| 26 | 移除 PIN 码 | 设备已设置 PIN | 执行 `onekey device change-pin --remove` | 设备确认后移除 PIN |
| 27 | 启用密码短语保护 | passphrase 已关闭 | 执行 `onekey device toggle-passphrase --enable true` | 启用密码短语保护；`device search` 显示 `passphrase_protection: true` |
| 28 | 禁用密码短语保护 | passphrase 已开启 | 执行 `onekey device toggle-passphrase --enable false` | #27 的反向操作 |
| 29 | 无效的 enable 参数 | 无 | 执行 `onekey device toggle-passphrase --enable yes` | 验证错误：`Invalid --enable value` |
| 30 | 修改设备标签 | 设备已连接 | 执行 `onekey device settings --label "My OneKey"` | 设备标签更新 |
| 31 | 设置自动锁定时间 | 设备已连接 | 执行 `onekey device settings --auto-lock-delay 60` | 自动锁定间隔设为 60 秒 |
| 32 | 无效的自动锁定时间（非数字） | 无 | 执行 `onekey device settings --auto-lock-delay abc` | CLI 拒绝：`Invalid --auto-lock-delay value: "abc"`——NaN 不会传给设备 |
| 33 | 自动锁定时间过小 | 无 | 执行 `onekey device settings --auto-lock-delay 0` | CLI 拒绝：必须在 `[10, 86400]` 秒内 |
| 34 | 自动锁定时间过大 | 无 | 执行 `onekey device settings --auto-lock-delay 86401` | CLI 拒绝：必须在 `[10, 86400]` 秒内 |
| 35 | 禁用触觉反馈 | 设备支持触觉反馈 | 执行 `onekey device settings --haptic-feedback false` | 触觉反馈禁用 |
| 36 | 无效的触觉反馈参数 | 无 | 执行 `onekey device settings --haptic-feedback maybe` | CLI 拒绝：`Invalid --haptic-feedback value: "maybe"` |
| 37 | 无设置参数 | 无 | 执行 `onekey device settings`（无选项） | 错误 `No settings provided` |

---

## 四、登出与状态查询

| # | 测试场景 | 前置条件 | 操作步骤 | 预期结果 |
|---|---------|---------|---------|---------|
| 38 | 硬件登录后登出 | 已通过硬件登录 | 执行 `onekey auth logout --yes` | `session.json` 删除；`KEYCHAIN_PASSPHRASE_STATE_KEY` + `KEYCHAIN_SESSION_ID_KEY` + 遗留 mnemonic/encryption 密钥全部清除；`auth status` 报告 `unauthenticated` |
| 39 | App 传输登录后登出 | 已通过 app-transfer 登录 | 执行 `onekey auth logout --yes` | `session.json` + mnemonic/encryption keychain 条目删除；硬件 keychain 条目无操作（从未存在） |
| 40 | 硬件登录后查看状态 | 刚完成硬件登录 | 执行 `onekey auth status` | `loginMethod: 'hardware'`、`walletKind: 'hardware'`、`device: { connectId, deviceId, deviceLabel }`、`displayAddress: 0x…` |

---

## 五、数据完整性与迁移

| # | 测试场景 | 前置条件 | 操作步骤 | 预期结果 |
|---|---------|---------|---------|---------|
| 41 | 遗留 session 格式 | `session.json` 包含 `login_method: 'mnemonic'` | 执行任意需认证命令 | Resolver 静默清除 keychain + session，报告 `unauthenticated` |
| 42 | 损坏的 session.json | 只包含部分硬件字段 | 执行任意需认证命令 | `AuthSessionStore.load()` 抛出 `AUTH_SESSION_INVALID`；resolver 清除**全部四个** keychain 密钥（包括 passphrase-state + session-id）——无陈旧状态泄漏到下次登录 |
| 43 | 硬件 session 往返 | 本 PR 写入的硬件 session | 再次读取 | `device` 和 `passphrase_mode` 完全往返 |

---

## 六、App 传输回归测试

| # | 测试场景 | 前置条件 | 操作步骤 | 预期结果 |
|---|---------|---------|---------|---------|
| 44 | App 传输登录 | 无 | 执行 `onekey auth login --app-transfer` | Bot 钱包配对完成，session 保存为 `loginMethod: 'app_transfer'`、`walletKind: 'hd'`，**无** `device` / `passphrase_mode` |
| 45 | App 传输会话查余额 | 已通过 app-transfer 登录 | 执行 `onekey balance --chain eth` | 通过 HD 助记词签名器工作；无硬件 SDK 加载，无 keychain passphrase 访问 |
| 46 | App 传输会话转账 | 已通过 app-transfer 登录 | 执行 `onekey transfer …` | 与之前相同的 EVM 代码路径（mnemonic → HD → raw sign） |

---

## 七、共享核心模块回归（kit-bg）

| # | 测试场景 | 前置条件 | 操作步骤 | 预期结果 |
|---|---------|---------|---------|---------|
| 47 | App 通过硬件钱包发送 EVM 交易 | OneKey 硬件钱包已连接 | 在 App 中发送 EVM 交易 | `KeyringHardware.signTransaction` 使用 `buildHardwareEvmTransaction` + `buildSignedTxFromSignatureEvm`；签名字节与之前类内实现完全一致 |
| 48 | EIP-1559 交易 | 硬件钱包 | 发送 EIP-1559 交易 | `maxFeePerGas` / `maxPriorityFeePerGas` 编码到 `IHardwareEvmTransactionEIP1559`；签名组装成有效的 type-2 序列化交易 |
| 49 | Legacy (type-0) 交易 | 硬件钱包 | 发送 legacy 交易 | `gasPrice` 编码到 `IHardwareEvmTransaction`；legacy `{v,r,s}` 组装工作正常 |

---

## 八、macOS Keychain 安全性

| # | 测试场景 | 前置条件 | 操作步骤 | 预期结果 |
|---|---------|---------|---------|---------|
| 50 | 进程列表安全检查 | macOS 系统 | 登录期间执行 `ps auxwww` | `security add-generic-password` 调用只显示 `security -i`；十六进制密码**不在** argv 中 |
| 51 | 存储后端确认 | 各平台 | 执行 `onekey auth status` 检查 `storage_backend` | macOS 显示 `macos-keychain`，Linux 显示 `linux-secret-service`（如有 libsecret） |

---

## 九、信号/退出处理

| # | 测试场景 | 前置条件 | 操作步骤 | 预期结果 |
|---|---------|---------|---------|---------|
| 52 | Ctrl-C 中断 | 任意硬件命令执行中 | 按 Ctrl-C | `SIGINT` 处理器调用 `disposeSDK` → USB 传输释放；进程以代码 130 退出 |
| 53 | 命令正常退出速度 | 无 | 执行 `onekey device search` 完成 | `beforeExit` 触发 `disposeSDK` → 进程在 <1 秒内退出（非 ~26 秒） |

---

## 十、人工冒烟测试清单（合并前必须完成）

- [ ] 真机 OneKey Touch 完整流程：`auth login --hardware` → `balance` → `transfer` → `auth logout`（模式 2：on_host）
- [ ] 相同流程（模式 3：on_device）
- [ ] 相同流程（模式 1：none，passphrase 禁用）
- [ ] `auth login --app-transfer` 完整流程（回归）
- [ ] 会话中手动锁定设备，执行钱包命令，确认自动重新提示
- [ ] `device search|verify|firmware|lock|change-pin|toggle-passphrase|settings` 各执行一次
- [ ] `device settings --auto-lock-delay 60` 生效；`--auto-lock-delay 0` / `--auto-lock-delay abc` 各被拒绝
- [ ] 验证硬件登录后 `~/.onekey/auth-session.json` 权限为 `0600`
- [ ] Linux 上确认 `libsecret` 路径端到端工作
- [ ] 验证 `onekey device <子命令>` 快速返回（<1 秒）——无 USB 句柄泄漏阻塞

---

## 自动化测试覆盖

项目已包含 **40 套件 / 348 个测试** 的自动化覆盖，执行方式：

```bash
cd apps/cli
npx tsc --noEmit     # 预期：apps/cli/src 内 0 错误
npx jest             # 预期：348 通过，40 套件
npx eslint src       # 预期：无警告
```

---

## 测试环境要求

| 项目 | 要求 |
|-----|------|
| 硬件设备 | OneKey Touch / OneKey Pro |
| 操作系统 | macOS / Linux（libsecret） |
| CLI 版本 | 本 PR 合并后的版本 |
| 固件版本 | 支持 `@onekeyfe/hd-*` 1.1.26-alpha.2 |

---

## 相关链接

- **PR**: https://github.com/OneKeyHQ/app-monorepo/pull/11135
- **配套 PR**: https://github.com/OneKeyHQ/onekey-wallet-skills/pull/4
