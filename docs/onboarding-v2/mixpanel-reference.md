# Mixpanel Reference - Onboarding Events

## Project IDs

| Project | ID |
|---------|-----|
| **OneKey 生产** | `3148553` |
| OneKey Test | `3229739` |

## Onboarding 核心事件

| 事件 | 含义 | 注意点 |
|------|------|--------|
| `addWalletStarted` | 用户开始添加钱包 | 5 个 addMethod: CreateWallet / ImportWallet / ConnectHWWallet / Connect3rdPartyWallet / CreateKeylessWallet |
| `walletAdded` | 成功添加 | 带 status: success/failure |
| `onboardingExit` | 用户退出 | 仅 v1 GetStarted 触发（useEffect cleanup），v2 完全缺失 |
| `pickYourDevice` / `connectYourDevice` / `hwDeviceConnected` | 硬件路径子事件 | connectYourDevice 量极少（35/30天），埋点有问题 |
| `onboard` | 老遗留事件 | 带 `onboardMethod` property |

## 关键数据解读规则

1. **"真实 onboarding 新用户"必须用 `isSoftwareWalletOnlyUser=true` 过滤**，否则数据被老用户二次操作污染（硬件数据膨胀 10 倍）
2. **Keyless addWalletStarted 严重低估**：GetStarted 首屏 Google/Apple 直登没调用 addWalletStarted，真实启动量 ~7,000+ 而非 552
3. **`details.*` 嵌套对象 breakdown 返回 undefined**：需改埋点展平
4. **3rd-party Wallet 的 46% 是 OneKey 自家设备**

## Keyless 流程无服务端埋点

`packages/shared/src/logger/scopes/wallet/scenes/keyless.ts` 有 22 个事件，全部 `@LogToLocal()`。改版后若要衡量 Keyless 体验，需升级为 `@LogToServer()`。

关注指标：
- Keyless 创建失败率
- Juicebox share 上传失败率
- PIN 创建放弃率
- Google/Apple 恢复失败原因
