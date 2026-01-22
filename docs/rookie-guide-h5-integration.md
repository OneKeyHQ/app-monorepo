# Rookie Guide H5 联调文档

## 概述

本文档面向 Rookie Guide H5 页面开发者，说明如何与 OneKey 钱包 App 进行通信，获取用户数据和触发原生功能。

---

## 1. API 调用方式

所有 API 通过 `window.$onekey.$private.request()` 方法调用：

```javascript
const result = await window.$onekey.$private.request({
  method: 'API_METHOD_NAME',
  params: { /* 参数对象 */ }
});
```

---

## 2. 可用 API 列表

### 2.1 `wallet_getRookieGuideInfo`

**用途**: 获取新手引导所需的用户信息

**重要行为**:
- 首次调用此 API 会自动激活任务追踪系统
- 只有激活后，用户在 App 内完成的任务才会被记录

**请求**:
```javascript
const info = await window.$onekey.$private.request({
  method: 'wallet_getRookieGuideInfo',
});
```

**响应**:
```typescript
interface IRookieGuideInfo {
  fiatBalance: string;      // 当前账户法币余额 (如 "1234.56")
  currency: string;         // 货币类型 (如 "usd")
  oneKeyId: {
    isLoggedIn: boolean;    // 是否已登录 OneKey ID
    email?: string;         // 邮箱 (已登录时)
    userId?: string;        // 用户 ID (已登录时)
  };
  instanceId: string;       // 设备实例 ID
  taskProgress: {
    deposit?: number;       // 充值任务完成时间戳 (存在即已完成)
    market?: number;        // 市场任务完成时间戳
    swap?: number;          // 兑换任务完成时间戳
    perps?: number;         // 合约任务完成时间戳
    dapp?: number;          // DApp 任务完成时间戳
  };
}
```

**示例响应**:
```json
{
  "fiatBalance": "150.25",
  "currency": "usd",
  "oneKeyId": {
    "isLoggedIn": true,
    "email": "user@example.com",
    "userId": "12345"
  },
  "instanceId": "abc123-def456",
  "taskProgress": {
    "deposit": 1705644800000,
    "swap": 1705731200000
  }
}
```

---

### 2.2 `wallet_resetRookieGuideProgress`

**用途**: 重置新手引导进度（用于测试或重新开始）

**请求**:
```javascript
const result = await window.$onekey.$private.request({
  method: 'wallet_resetRookieGuideProgress',
});
```

**响应**:
```typescript
{ success: boolean }
```

---

### 2.3 `wallet_showRookieShare`

**用途**: 触发 App 原生分享弹窗，生成分享图片

**请求**:
```javascript
const result = await window.$onekey.$private.request({
  method: 'wallet_showRookieShare',
  params: {
    data: {
      // 必填字段
      imageUrl: 'https://example.com/badge.png',  // 徽章/头像图片 URL
      title: 'How to deposit? Your first step on-chain',  // 主标题

      // 可选字段
      subtitle: 'Every step brings you closer to Web3',  // 副标题
      footerText: 'Open source and easy to use from day one.',  // 底部文案
      referralCode: 'ABC123',  // 邀请码（显示在底部）
      referralUrl: 'https://web.onekey.so/learning?ref=ABC123',  // 邀请链接（用于生成二维码）
    }
  }
});
```

**参数说明**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `imageUrl` | string | ✅ | 徽章图片 URL，建议 HTTPS |
| `title` | string | ✅ | 主标题文案 |
| `subtitle` | string | ❌ | 副标题文案 |
| `footerText` | string | ❌ | 底部描述，默认 "Open source and easy to use from day one." |
| `referralCode` | string | ❌ | 邀请码，会显示在图片底部 |
| `referralUrl` | string | ❌ | 邀请链接，用于生成二维码 |

**响应**:
```typescript
{ success: boolean }
```

**错误处理**:
```javascript
try {
  await window.$onekey.$private.request({
    method: 'wallet_showRookieShare',
    params: { data: { imageUrl: '', title: '' } }
  });
} catch (error) {
  // Error: "Invalid share data: imageUrl and title are required"
}
```

---

## 3. 任务类型与触发条件

H5 端无需手动记录任务完成，App 会自动追踪以下行为：

| 任务类型 | 枚举值 | 触发条件 |
|----------|--------|----------|
| **充值** | `deposit` | HD/Keyless/硬件钱包账户余额 > 0 |
| **市场** | `market` | 用户将代币添加到自选列表 |
| **兑换** | `swap` | 用户完成一笔 Swap 交易 |
| **合约** | `perps` | 用户在 Hyperliquid 下单成功 |
| **DApp** | `dapp` | _待实现_ |

**重要**: 任务只有在用户打开过 H5 引导页（调用过 `wallet_getRookieGuideInfo`）后才会被记录。

---

## 4. 完整代码示例

```javascript
// 1. 页面加载时获取用户信息
async function initRookieGuide() {
  try {
    const info = await window.$onekey.$private.request({
      method: 'wallet_getRookieGuideInfo',
    });

    console.log('User balance:', info.fiatBalance, info.currency);
    console.log('OneKey ID logged in:', info.oneKeyId.isLoggedIn);
    console.log('Completed tasks:', Object.keys(info.taskProgress));

    // 根据 taskProgress 渲染进度 UI
    renderProgress(info.taskProgress);

  } catch (error) {
    console.error('Failed to get rookie guide info:', error);
  }
}

// 2. 用户点击分享按钮
async function handleShare(badgeData) {
  try {
    await window.$onekey.$private.request({
      method: 'wallet_showRookieShare',
      params: {
        data: {
          imageUrl: badgeData.imageUrl,
          title: badgeData.title,
          subtitle: badgeData.subtitle,
          referralCode: 'USER123',
          referralUrl: 'https://web.onekey.so/learning?ref=USER123',
        }
      }
    });
  } catch (error) {
    console.error('Failed to show share dialog:', error);
  }
}

// 3. 重置进度（测试用）
async function resetProgress() {
  await window.$onekey.$private.request({
    method: 'wallet_resetRookieGuideProgress',
  });
  // 重新获取信息
  await initRookieGuide();
}
```

---

## 5. 调试与测试

### 5.1 Gallery 测试页面

App 内置了 Rookie Guide 测试页面，可用于调试分享功能。

**访问路径**:
```
开发者菜单 → Gallery → ComponentRookieGuide
```

**功能**:
- 在 Modal 中打开 H5 页面
- 在 Discovery 浏览器中打开 H5 页面
- 测试分享弹窗（使用 Mock 数据）

### 5.2 开发环境配置

开发环境下，H5 页面可使用 `http://localhost:3002` 或 `http://localhost:3008` 进行测试。

**白名单 Origin**（开发环境）:
- `http://localhost:3008`
- `http://localhost:8081`
- 各种 LAN IP（`192.168.x.x:3008`）

**生产环境 Origin**:
- `https://onekey.so`
- `https://1key.so`
- `https://*.onekey.so`

### 5.3 Console 调试

在 App 内的 WebView 中，可直接在控制台执行 API 调用进行调试：

```javascript
// 测试获取信息
window.$onekey.$private.request({ method: 'wallet_getRookieGuideInfo' })
  .then(console.log)
  .catch(console.error);

// 测试分享弹窗
window.$onekey.$private.request({
  method: 'wallet_showRookieShare',
  params: {
    data: {
      imageUrl: 'https://uni.onekey-asset.com/static/logo/onekey-icon-256.png',
      title: 'Test Share Title',
      subtitle: 'Test subtitle',
      referralCode: 'TEST123',
      referralUrl: 'https://web.onekey.so/learning?ref=TEST123',
    }
  }
}).then(console.log).catch(console.error);
```

---

## 6. 数据流图

```
┌─────────────────────────────────────────────────────────────────────┐
│                          H5 Rookie Guide                             │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                │ window.$onekey.$private.request()
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Provider API Private                           │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ wallet_getRookieGuideInfo  → 返回用户数据 + 激活任务追踪     │    │
│  │ wallet_resetRookieGuideProgress → 重置所有进度              │    │
│  │ wallet_showRookieShare → 触发原生分享弹窗                   │    │
│  └─────────────────────────────────────────────────────────────┘    │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      App 自动任务追踪                                │
│                                                                     │
│   用户行为                          任务记录                         │
│   ─────────                        ──────────                       │
│   账户余额 > 0        ───────────▶  DEPOSIT ✓                       │
│   添加自选代币        ───────────▶  MARKET ✓                        │
│   完成 Swap          ───────────▶  SWAP ✓                          │
│   Hyperliquid 下单   ───────────▶  PERPS ✓                         │
│   (待实现)           ───────────▶  DAPP ✓                          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 7. TypeScript 类型定义

如果 H5 使用 TypeScript，可复制以下类型定义：

```typescript
// 任务类型枚举
enum ERookieTaskType {
  DEPOSIT = 'deposit',
  MARKET = 'market',
  SWAP = 'swap',
  PERPS = 'perps',
  DAPP = 'dapp',
}

// 任务进度
interface IRookieGuideProgress {
  [ERookieTaskType.DEPOSIT]?: number;
  [ERookieTaskType.MARKET]?: number;
  [ERookieTaskType.SWAP]?: number;
  [ERookieTaskType.PERPS]?: number;
  [ERookieTaskType.DAPP]?: number;
}

// OneKey ID 信息
interface IRookieGuideOneKeyIdInfo {
  isLoggedIn: boolean;
  email?: string;
  userId?: string;
}

// getRookieGuideInfo 响应
interface IRookieGuideInfo {
  fiatBalance: string;
  currency: string;
  oneKeyId: IRookieGuideOneKeyIdInfo;
  instanceId: string;
  taskProgress: IRookieGuideProgress;
}

// showRookieShare 参数
interface IRookieShareData {
  imageUrl: string;      // 必填
  title: string;         // 必填
  subtitle?: string;
  footerText?: string;
  referralCode?: string;
  referralUrl?: string;
}
```

---

## 8. 注意事项

1. **激活机制**: 必须先调用 `wallet_getRookieGuideInfo` 激活任务追踪，否则用户在 App 内的操作不会被记录。

2. **分享图片生成**: `wallet_showRookieShare` 调用后，App 会在本地生成 640x640 的分享图片，支持保存到相册、系统分享和分享到 X (Twitter)。

3. **轮询建议**: 如需实时更新任务进度，建议每 5-10 秒轮询一次 `wallet_getRookieGuideInfo`。

4. **错误处理**: 所有 API 调用应包裹在 try-catch 中，以处理用户未安装 OneKey 或 API 不可用的情况。

---

**文档版本**: 1.0
**更新日期**: 2026-01-22
**对应分支**: `feat/onekey-learning`
