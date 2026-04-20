# Onboarding v2 - Data Analysis

> 数据源：Mixpanel 30 天数据，生产环境（project 3148553）

## 硬件数据反转（关键发现）

`walletAdded` 事件中 `addMethod=ConnectHardware` 的 10,353 条，按 `isSoftwareWalletOnlyUser` 拆分：

| 用户类型 | 数量 | 占比 |
|---------|------|------|
| false（已有硬件用户再加设备） | 9,363 | 90% |
| true（真正的 onboarding 新硬件用户） | 1,077 | 10% |

**结论**：ConnectHardware 的高量被老用户二次加设备严重污染。真实 onboarding 新用户中硬件只占 8%。

### 真实 onboarding 新用户 walletAdded 比例（SW-only=true 口径）

| 路径 | 占比 |
|------|------|
| 创建钱包 | 60% |
| 导入已有 | 32% |
| 连接硬件 | 8% |

## Keyless 启动量失真

| 指标 | 数值 | 问题 |
|------|------|------|
| addWalletStarted CreateKeylessWallet | 552 | 严重低估 |
| walletAdded CreateKeylessWallet | 6,484 | 真实完成量 |
| 推算真实启动量 | ~7,000+ | GetStarted 首屏 Google/Apple 直登没调用 addWalletStarted |

## 3rd-party Wallet 的 46% 是 OneKey 自家

Connect3rdPartyWallet walletAdded 973 条按 walletName 拆分：
- OneKey Android + iOS + EIP6963 合计 448（46%）
- 用户其实是在 OneKey 设备间同步

**影响 Q4 决策**：是否在 3rd-party wallet 副文本加 `Including your OneKey Mobile`

## addWalletStarted 的 ConnectHWWallet 数据

10,732 条中 3,035（28%）来自已有硬件用户 — 同样被老用户污染。

## 埋点质量问题

1. **details.* 嵌套对象不可 breakdown**：`details.importType` / `details.provider` / `details.unbackedUp` 在 Mixpanel breakdown 返回 undefined，需展平
2. **Keyless 流程零服务端埋点**：`packages/shared/src/logger/scopes/wallet/scenes/keyless.ts` 的 22 个事件全部 `@LogToLocal()`，不上报服务器
3. **onboardingExit 仅 v1 触发**：v2 完全缺失退出事件
4. **connectYourDevice 量极少**（35/30天），埋点有问题
