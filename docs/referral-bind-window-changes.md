# 返佣 14 天绑码窗口期 — 客户端改动说明

> Jira: OK-51210

## 背景

当前返佣系统中邀请码绑定没有时间限制。本次改动新增「14 天绑码窗口期」：钱包创建后 14 天内可绑定邀请码，超过则永久无法绑定。后端 API 由服务端团队开发，本文档仅说明客户端改动。

---

## 流程一：用户创建新钱包

用户在 App 中创建或导入一个新钱包时，会经历以下流程：

```
用户点击「创建钱包」
       │
       ▼
┌─────────────────────────────┐
│  createHDWallet() 完成      │  钱包写入本地数据库
│  进入 FinalizeWalletSetup   │  (v1 和 v2 两套 Onboarding 都覆盖)
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  getReferralCodeWalletInfo()        │  从钱包中解析出首地址
│  HD → 首个 EVM 地址                │  (新增的 service 方法)
│  BTC-only → 首个 Taproot 地址      │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  先缓存 walletCreatedAt 到本地 DB   │  SimpleDB
│  再 await recordWalletCreation()    │  POST /wallet/creation-records
│  payload: { address, networkId,     │
│            walletCreatedAt }        │
│  服务端据此开始计算 14 天窗口       │
│  幂等 —— 已存在的地址不会重置计时   │
└─────────────┬───────────────────────┘
              │
              │  这里必须 await，不能 fire-and-forget
              │  因为下一步要问服务端「能不能绑」
              │  如果服务端还没收到创建记录，会给出错误答案
              │
              ▼
┌─────────────────────────────────────┐
│  checkWalletBindStatus()            │  GET /wallet/check
│  skipIfTimeout: true (3秒超时)      │
│  服务端返回 { data, bindable, reason }
│                                     │
│  data = true  → 已绑定              │
│  bindable = true → 可以绑           │
│  bindable = false + reason =        │
│    'exceeded_bind_window' → 过期了  │
│                                     │
│  注意：导入已有助记词或连接硬件钱包  │
│  时地址可能已在服务端注册过，14 天   │
│  窗口可能已过期，所以此步不能省略    │
└─────────────┬───────────────────────┘
              │
              │  把结果写入本地 SimpleDB
              │  { isBound, bindable, bindWindowReason }
              │
              ▼
┌─────────────────────────────────────┐
│  bindable && !isBound ?             │
│    → 弹出邀请码输入框               │
│  否则                               │
│    → 直接进入主页                    │
└─────────────────────────────────────┘
```

**v1 与 v2 的触发条件：**

| 版本 | 路由 | 触发场景 |
|------|------|----------|
| v2 (`Onboardingv2/`) | `ERootRoutes.Onboarding` | 首次 onboarding（无钱包时）、全新引导流程 |
| v1 (`Onboarding/`) | `EModalRoutes.OnboardingModal` | App 内弹窗式钱包创建/导入（DApp 连接、钱包管理页等） |

两个版本逻辑一致：缓存创建时间 → 上报创建 → 检查绑定状态 → 根据结果弹框或关闭页面。区别仅在 UI 层（v2 用 `OnboardingLayout.Footer`，v1 用 `Page.Footer`）。

**失败处理：** `recordWalletCreation` 如果网络失败，静默跳过。因为 `walletCreatedAt` 已经先写入本地，所以下次 App 启动时的迁移流程会沿用同一个时间重试，不会把失败重试误判成“刚创建”（见流程三）。

**Keyless 补充：** v2 keyless onboarding 中，即使出现邀请码绑定 footer，也仍会保持后续 auto-connect 流程：

- 不需要绑码：按原路径关闭页面后自动拉起 auto-connect
- 点击「完成」：关闭页面后自动拉起 auto-connect
- 点击「绑定邀请码」：绑定弹窗成功关闭后自动拉起 auto-connect；用户直接关闭该弹窗时也会继续 auto-connect

---

## 流程二：用户打开钱包管理页 / 邀请码弹窗

用户在 App 中查看钱包列表或打开邀请码绑定弹窗时，每个钱包需要展示当前状态。

```
打开 InviteCodeDialog 或钱包管理页
       │
       ▼
┌─────────────────────────────────────┐
│  useFetchWalletsWithBoundStatus()   │  遍历所有 HD/HW 钱包
│  收集每个钱包的首地址               │
└─────────────┬───────────────────────┘
              │
              ▼
┌──────────────────────────────────────────┐
│  尝试调用 V2 API                          │
│  POST /wallet/batch-check-v2             │
│  返回 { bound, bindable, reason } 每个地址│
│                                          │
│  如果 V2 失败（404 或其他错误）：         │
│    回退到 V1 API（POST /wallet/batch-check）
│    V1 只返回 boolean，无法区分             │
│    「未绑定」和「已过期」                  │
│    → 保留本地 DB 中已有的 bindable 值      │
│    → 不用 V1 的结果覆盖                   │
│                                          │
│  如果 V2 和 V1 都失败：                  │
│    → 不把空结果推导成「未绑定 / 可绑定」 │
│    → 只读取本地已有缓存用于展示           │
│    → 跳过 SimpleDB 写入，避免把           │
│       bindable=false 覆盖成 true          │
└─────────────┬────────────────────────────┘
              │
              │  只有服务端刷新成功时才写入本地 SimpleDB
              │
              ▼
┌──────────────────────────────────────────┐
│  UI 根据三种状态展示不同样式              │
│                                          │
│  ① 可绑定 (bindable=true, isBound=false) │
│     → 可选择，无特殊标记                  │
│                                          │
│  ② 已绑定 (isBound=true)                 │
│     → 禁用，蓝色 Badge「已绑定」          │
│                                          │
│  ③ 不适用 (bindable=false, 窗口已过期)    │
│     → 禁用，灰色 Badge「不适用」          │
│     → 选中时显示说明文案                  │
│                                          │
│  ② 和 ③ 在 UI 行为上一样：               │
│     → 都不再展示绑定入口 / 绑定弹窗       │
│     → 区别只保留在状态原因和文案上         │
│                                          │
│  所有钱包都是 ② 或 ③ 时：                │
│     → 显示「所有钱包已绑定」空状态        │
└──────────────────────────────────────────┘
```

**三个展示位置都做了适配：**

- **InviteCodeDialog**（邀请码弹窗内的钱包选择器）：三态选择项 + 状态描述文案
- **WalletBoundReferralCodeButton**（钱包编辑页的按钮）：三态 Badge 样式
- **ReferralCodeBlock**（首页卡片）：过期钱包不显示绑定入口

**本地缓存可信规则：**

入口展示不能无限信任本地缓存中的“可绑定”状态，否则 14 天窗口过期后仍可能继续显示绑定入口。当前规则如下：

| 本地缓存状态 | 是否直接可信 | 处理方式 |
|--------------|--------------|----------|
| `isBound=true` | 是 | 已绑定是稳定状态，直接不展示绑定入口 |
| `bindable=false` | 是 | 窗口已过期是稳定状态，直接不展示绑定入口 |
| `bindable=true` | 否 | 必须重新调用 `checkWalletBindStatus()` 确认 |
| `bindable=undefined` | 否 | 兼容老数据，按未知状态处理，必须重新确认 |

如果 `bindable=true` 或 `bindable=undefined` 的缓存重新校验失败，客户端不会仅凭缓存展示绑定入口；避免离线、5xx 或服务端异常时把已过期钱包重新显示为可绑定。

---

## 流程三：老用户升级 App

老用户升级到新版本后，他们已有的钱包从未上报过创建时间。需要一次性补报。

```
App 启动
  │
  ▼
ServiceBootstrap.init()
  │
  │  跟其他迁移任务并列，fire-and-forget
  │  (migrateHdWalletsBackedUpStatus 等)
  │
  ▼
migrateCreationRecordsIfNeeded()
  │
  ├── 检查 creationRecordsMigrationDone 标记
  │   │
  │   ├── 已完成 → 直接返回，不做任何事
  │   │
  │   └── 未完成 ↓
  │
  ▼
遍历所有 HD / HW 钱包
  │
  │  对每个钱包：
  │  1. getReferralCodeWalletInfo() 解析首地址
  │  2. 解析 walletCreatedAt，优先级：
  │     a. onboarding 已缓存的创建时间
  │     b. 硬件设备的 createdAt
  │     c. 对拿不到真实时间的 legacy 钱包，
  │        使用一个保守的“已过窗口”回填时间
  │  3. 收集到 items 数组
  │  4. 解析失败的钱包先记下来，不标记完成
  │
  ▼
按 100 个一批调用 recordWalletCreation()
  │
  │  POST /wallet/creation-records
  │  item = { address, networkId, walletCreatedAt }
  │  服务端是幂等的（同一地址不会重复记录）
  │
  ▼
所有批次成功，且没有 unresolved 钱包
            → 设置 creationRecordsMigrationDone = true
            → 下次启动不再执行
  │
  没有钱包 / 有钱包未解析成功 / 任意批次失败
            → 不设置标记
            → 下次启动重试整个流程
```

**并发保护：** 如果 `migrateCreationRecordsIfNeeded` 被同时调用两次（比如 Extension background 快速重启），内部通过 `_migrationPromise` 去重，第二次调用会等待第一次的结果。

**为什么对 legacy 钱包要走保守 fallback？**

老的 HD 钱包本地并没有可靠的 `createdAt` 字段。如果升级时直接把“当前升级时间”回填给服务端，会错误地给老钱包重新发放一段新的 14 天窗口。客户端现在改成保守策略：拿不到可信历史时间时，显式按“已过窗口”的时间去补报，避免把老用户错误恢复成可绑定状态。

---

## 流程四：用户尝试绑定已过期的钱包

即使前端已经做了 UI 层面的禁用，仍可能出现服务端拒绝绑定的情况（比如本地缓存过期）。

```
用户点击「确认绑定」
  │
  ▼
confirmBindReferralCode()
  │
  ├── 获取签名消息 → 签名 → 提交到 POST /wallet/bind
  │
  │   服务端做窗口期校验：
  │   ├── 通过 → 绑定成功，正常流程
  │   └── 失败 → 返回 exceeded_bind_window 错误
  │
  ▼
catch 捕获错误
  │
  ├── 精确匹配 err.message === 'exceeded_bind_window'
  │   或 err.key / err.code === 'exceeded_bind_window'
  │
  ├── 匹配到 → Toast 显示「该钱包创建已超过 14 天，无法绑定邀请码」
  │
  └── 未匹配 → 显示原始错误消息（和之前一样）
```

---

## 容错总结

```
                  正常路径              失败时怎么办
                  ────────             ────────────
创建上报          await 成功            静默跳过，启动迁移补救
启动迁移          一次性跑完            不标记完成，下次重试
V2 状态查询       拿到 bindable         回退 V1，保留本地已有值
单钱包状态查询    拿到 bindable         bindable 未知时按 !isBound 处理
API 超时          3 秒后放弃            不写本地 DB，避免污染已有记录
API 500/网络错    正常无此分支            优先用本地缓存；没有缓存时按默认值处理
绑定被服务端拒绝  不会发生(UI 已禁用)    精确匹配错误，显示本地化提示
老客户端          无 creation-records   服务端默认允许绑定（向下兼容）
```

---

## 涉及的文件

```
shared/
  ├── referralCode/type.ts                    新增类型定义
  └── referralCode/creationRecordUtils.ts     创建时间回填策略

kit-bg/
  ├── dbs/simple/entity/SimpleDbEntityReferralCode.ts   扩展本地存储
  ├── services/ServiceReferralCode.ts                   新增 5 个 service 方法
  └── services/ServiceBootstrap.ts                      启动迁移入口

kit/
  ├── views/Onboarding/pages/FinalizeWalletSetup.tsx       v1 创建上报
  ├── views/Onboardingv2/pages/FinalizeWalletSetup.tsx     v2 创建上报
  ├── views/Onboardingv2/pages/finalizeWalletSetupKeylessUtils.ts  keyless auto-connect 调度
  ├── views/ReferFriends/hooks/
  │   ├── useWalletBoundReferralCode/
  │   │   ├── useFetchWalletsWithBoundStatus.ts   V1→V2 升级 + fallback
  │   │   ├── InviteCodeDialog.tsx                三态钱包选择器
  │   │   └── useWalletBoundReferralCode.tsx      核心状态查询 + dialog close 回调
  │   └── useCheckWalletReferralCodeBound.ts      bindable 条件
  ├── views/AccountManagerStacks/.../WalletBoundReferralCodeButton.tsx  三态 Badge
  └── views/Home/.../ReferralCodeBlock.tsx         过期时隐藏输入框
```
