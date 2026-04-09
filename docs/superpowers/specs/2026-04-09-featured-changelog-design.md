# Featured Changelog — 版本特色展示

> Jira: [OK-52369](https://onekeyhq.atlassian.net/browse/OK-52369)
> 版本: App-6.1.0
> 平台: 全平台 (iOS / Android / Desktop / Web / Extension)
> 日期: 2026-04-09

---

## 1. 问题

当前每次版本更新后，App 弹出 Release Note（WhatsNew 页面），以 markdown 列表展示全部技术变更。用户行为是直接关掉，不看。

这浪费了"更新后首次打开"这个高注意力时刻。OneKey 的核心竞争优势（0 手续费、Keyless、能量补贴等）对已有用户来说是隐形的。

**核心原则**（来自 Slack 讨论共识）：
> "宣传嵌入体验，用户在使用过程中自然看到优势。"
> "弹「版本特色」替代「Release Note」。" — Patrick

## 2. 范围

### 在范围内

- **L1 — 版本特色浮层**：更新后弹出的模态卡片，展示 1-3 个版本亮点

### 不在范围内

- L2 更新日志改造（现有 WhatsNew 保持不变）
- Newsletter 同步（已否掉）
- Swap 选择代币分类（已否掉）
- 零费率可视化（6.0 已上线）
- Tron 专项引导（6.0 已上线）
- 股票专区 / 多链股票代币展示（另行跟进）

## 3. 设计方案

### 3.1 触发与替代

| 规则 | 行为 |
|------|------|
| 触发时机 | 版本更新后首次打开 App |
| 替代关系 | 后台有配置「版本特色」时 → 展示版本特色浮层，**替代**现有 WhatsNew 弹出 |
| 无配置时 | 静默，什么都不弹（不降级回 Release Note） |
| 展示次数 | 每个版本最多展示一次，关闭后不再弹出 |

### 3.2 浮层形式

**大面积模态卡片**（参考 Claude.ai "What's New" 组件）：
- 使用现有 Modal 组件
- **不使用 Modal Header**（无自带 ✕ 按钮），是否增加自定义关闭按钮待定
- 关闭方式：点击蒙层 / 系统返回手势
- 全平台统一形式，Footer 响应式适配

### 3.3 信息层级（标题优先）

从上到下：

```
┌─ Modal (no header) ────────────────────┐
│                                        │
│  [NEW 徽标]                             │
│  What's New in v{版本号}                │  ← 固定标题
│  本次更新的亮点功能                       │  ← 固定副标题
│                                        │
│  [Tab 1] [Tab 2] [Tab 3]              │  ← 亮点切换（仅 1 个时隐藏）
│                                        │
│  ┌──────────────────────────────────┐  │
│  │         image / video            │  │  ← 媒体区域（随 Tab 切换）
│  └──────────────────────────────────┘  │
│                                        │
│  Feature Title                         │  ← 亮点标题（随 Tab 切换）
│  Feature description...                │  ← 亮点描述（随 Tab 切换）
│                                        │
├─ Modal Footer ─────────────────────────┤
│  查看完整更新日志 ›       [Primary CTA]  │  ← 大屏：左右并排
│                                        │
│          [Primary CTA]                 │
│      查看完整更新日志 ›                  │  ← 小屏：上下堆叠
└────────────────────────────────────────┘
```

### 3.4 Tab 切换

| 规则 | 行为 |
|------|------|
| 样式 | 水平排列的 pill/chip 按钮 |
| 数量上限 | 最多 3 个 |
| 仅 1 个亮点 | Tab 行隐藏，媒体区域可略大 |
| 0 个亮点 | 不弹浮层 |
| 默认激活 | 第一个 Tab（优先级最高的亮点） |
| 切换行为 | 点击 Tab → 媒体、标题、描述、CTA 全部联动切换 |
| 切换动画 | 内容区过渡动画（渐变或滑动） |

### 3.5 媒体区域

| 规则 | 行为 |
|------|------|
| 支持类型 | 图片（静态插画 / 功能截图）或视频 |
| 视频播放 | 静音自动播放，循环 |
| 切换 Tab | 视频从头播放 |
| 加载 | 图片/视频从 URL 远程加载，需显示 loading 状态 |

### 3.6 Footer

使用 Modal Footer 已有的自定义元素属性：

| 屏幕 | 布局 |
|------|------|
| **大屏**（Desktop / Web / Extension） | 左侧：「查看完整更新日志」链接；右侧：Primary CTA 按钮 |
| **小屏**（Mobile） | 上方：Primary CTA 按钮（full-width）；下方：「查看完整更新日志」链接（居中） |

- **Primary CTA**：随 Tab 切换，每个亮点有独立的按钮文字和 deep link
- **查看完整更新日志**：点击后打开现有的完整 changelog（WhatsNew 页面）

### 3.7 关闭行为

| 操作 | 结果 |
|------|------|
| 点击蒙层 | 关闭浮层 |
| 系统返回手势 | 关闭浮层 |
| 自定义 ✕ 按钮 | **待定**，后续决定是否添加 |
| 点击 Primary CTA | 关闭浮层 + 跳转到对应功能页 |
| 点击「查看完整更新日志」 | 关闭浮层 + 打开 changelog |

关闭后标记为已展示，同一版本不再弹出。

## 4. 数据模型

### 4.1 版本特色配置（后台下发）

每个版本的特色配置包含 1-3 个亮点条目：

```
FeaturedChangelog {
  version: string              // 目标版本号，如 "6.1.0"
  features: FeaturedItem[]     // 1-3 个亮点，按优先级排序
}

FeaturedItem {
  tab_label: string            // Tab 按钮文字，如 "⚡ 0 手续费"
  title: string                // 亮点标题，≤15 字
  description: string          // 亮点描述，≤40 字
  media_url: string            // 图片或视频 URL
  media_type: "image" | "video"
  cta_text: string             // 按钮文字，如 "立即体验"
  cta_deeplink: string         // 点击后跳转的 deep link
}
```

### 4.2 展示记录（本地）

复用现有的 WhatsNew shown 追踪机制（`onekey_whats_new_shown`），记录版本号，防止重复展示。

## 5. 平台适配

| 平台 | 适配说明 |
|------|---------|
| **iOS / Android** | 标准 Modal，Footer 堆叠布局 |
| **Desktop** | 居中 Modal，Footer 并排布局 |
| **Web** | 同 Desktop |
| **Extension** | 居中 Modal，受 popup 尺寸约束，可能需要缩小媒体区域 |

所有平台使用同一个 Modal 组件，通过 Footer 响应式属性自动适配。

## 6. 边界情况

| 场景 | 处理 |
|------|------|
| 版本无配置 | 不弹浮层，静默 |
| 仅 1 个亮点 | Tab 行隐藏 |
| 媒体加载失败 | 展示 fallback 占位符，不阻塞其他内容 |
| 用户未更新直接安装新版 | 视为"首次打开新版本"，正常触发 |
| JS Bundle 热更新 | 按现有逻辑判断版本变化，触发展示 |
| 多次热更新同一版本 | 仅首次触发，后续不重复 |

## 7. 后台设计（Dashboard + API）

### 7.1 概述

在现有自研 Dashboard 中新增「版本特色」配置模块，与 Banner / App Update 管理并列。运营/PM 在 Dashboard 中配置每个版本的亮点内容，客户端通过 API 拉取。

### 7.2 Dashboard — 配置管理

#### 入口

Dashboard 侧边栏新增「版本特色 / Featured Changelog」菜单项，与 Banner、App Update 同级。

#### 列表页

展示所有已配置的版本特色：

| 列 | 说明 |
|----|------|
| 版本号 | 如 "6.1.0" |
| 亮点数量 | 如 "3 个亮点" |
| 状态 | 草稿 / 已发布 / 已过期 |
| 创建时间 | — |
| 操作 | 编辑 / 发布 / 下线 / 删除 |

#### 编辑页

配置一个版本的特色内容：

**基础信息：**

| 字段 | 类型 | 说明 |
|------|------|------|
| 目标版本号 | 输入框 | 如 "6.1.0"，用于匹配客户端版本 |
| 状态 | 下拉 | 草稿 / 已发布 |

**亮点列表（1-3 个，可拖拽排序调整优先级）：**

每个亮点条目包含：

| 字段 | 类型 | 校验规则 | 说明 |
|------|------|---------|------|
| Tab 文字 | 文本输入 | 必填，≤10 字 | 如 "⚡ 0 手续费" |
| 标题 | 文本输入 | 必填，≤15 字 | 如 "Perps 交易，0 手续费" |
| 描述 | 文本输入 | 必填，≤40 字 | 如 "所有合约订单享受零费率交易体验。" |
| 媒体类型 | 单选 | image / video | — |
| 媒体文件 | 上传 / URL | 必填 | 上传到 CDN，或填写已有 CDN URL |
| CTA 按钮文字 | 文本输入 | 必填，≤8 字 | 如 "立即体验" |
| CTA Deep Link | 文本输入 | 必填 | 如 `onekey://perps` |

**操作按钮：**
- 「保存草稿」— 保存但不下发给客户端
- 「发布」— 下发给客户端，版本匹配后生效
- 「预览」— 模拟客户端展示效果（见 7.3）

#### 校验规则

| 规则 | 说明 |
|------|------|
| 版本号唯一 | 同一版本号只能有一个配置（不论状态） |
| 亮点数量 | 最少 1 个，最多 3 个 |
| 媒体必填 | 每个亮点必须上传/填写媒体 URL |
| Deep Link 格式 | 校验是否为合法的 App deep link |

### 7.3 Dashboard — 预览

配置完成后，Dashboard 提供预览功能：

- 以 iframe 或独立弹窗展示客户端的模态卡片效果
- 支持切换"小屏 / 大屏"模式预览不同 Footer 布局
- 可点击 Tab 切换，验证内容和媒体是否正确
- 视频可正常播放

预览不影响线上状态，仅供编辑者确认。

### 7.4 API 设计

#### 方案：扩展现有 App Update API

在现有 `/utility/v1/app-update/version-info` 响应中新增 `featuredChangelog` 字段。客户端已在更新流程中调用此 API，无需额外请求。

#### 响应结构变化

现有响应（保持不变）：
```json
{
  "latestVersion": "6.1.0",
  "changeLog": "### v6.1.0\n- Fix ...",
  "updateStrategy": 0,
  ...
}
```

新增字段：
```json
{
  "latestVersion": "6.1.0",
  "changeLog": "...",
  "updateStrategy": 0,
  "featuredChangelog": {
    "version": "6.1.0",
    "features": [
      {
        "tabLabel": "⚡ 0 手续费",
        "title": "Perps 交易，0 手续费",
        "description": "所有合约订单享受零费率交易体验。",
        "mediaUrl": "https://cdn.onekey.so/featured/v6.1/perps-zero-fee.mp4",
        "mediaType": "video",
        "ctaText": "立即体验",
        "ctaDeeplink": "onekey://perps"
      },
      {
        "tabLabel": "🔑 Keyless",
        "title": "Keyless 钱包，无需助记词",
        "description": "用 iCloud / Google 账号直接创建钱包。",
        "mediaUrl": "https://cdn.onekey.so/featured/v6.1/keyless.png",
        "mediaType": "image",
        "ctaText": "创建 Keyless 钱包",
        "ctaDeeplink": "onekey://keyless/create"
      }
    ]
  }
}
```

#### 客户端判断逻辑

```
1. 调用 version-info API
2. if response.featuredChangelog 存在且 features 非空
     → 展示版本特色浮层（替代 WhatsNew）
3. else
     → 静默（不弹任何东西）
```

#### 缓存策略

- 复用现有 version-info 的缓存机制（当前 5 分钟 memoize）
- `featuredChangelog` 跟随主响应一起缓存，无需单独处理

### 7.5 媒体资源

| 规则 | 说明 |
|------|------|
| 存储 | 上传到现有 CDN |
| 图片格式 | PNG / JPG / WebP |
| 图片建议尺寸 | 宽度 ≥ 750px（适配 Retina） |
| 视频格式 | MP4 (H.264) |
| 视频时长 | 建议 ≤ 15 秒 |
| 视频大小 | 建议 ≤ 5MB（移动端流量友好） |
| 文件命名 | 按版本号组织目录，如 `featured/v6.1/` |

### 7.6 状态流转

```
草稿 (draft)
  │
  ├── 发布 ──→ 已发布 (published)
  │                │
  │                ├── 下线 ──→ 已下线 (archived)
  │                │
  │                └── 编辑 ──→ 已发布 (直接生效)
  │
  └── 删除 ──→ (永久删除)
```

| 状态 | 客户端可见 | 说明 |
|------|-----------|------|
| 草稿 | 否 | 配置中，不下发 |
| 已发布 | 是 | API 返回此版本的 featuredChangelog |
| 已下线 | 否 | 手动关闭，API 不再返回 |

### 7.7 运营工作流

```
1. 版本发布前：PM/运营在 Dashboard 创建版本特色配置（草稿）
2. 填写亮点内容 → 上传媒体 → 预览确认
3. 版本发布当天：在 Dashboard 点击「发布」
4. 客户端更新后首次打开 → API 返回 featuredChangelog → 展示浮层
5. 下个版本发布时：旧版本配置自动不再匹配，无需手动下线
```

## 8. 设计决策记录

| 决策 | 选择 | 原因 |
|------|------|------|
| 浮层形式 | 大面积模态卡片 | 参考 Claude.ai "What's New"，平衡视觉冲击力和侵入感 |
| 信息层级 | 标题优先 | Tab 在上方发现性强，全平台适配灵活 |
| 多亮点策略 | 单次 Tab 切换 | 一次性展示，不分天打扰 |
| L2 更新日志 | 不改动 | 最小范围，现有 WhatsNew 保持原样 |
| 内容来源 | 后台配置下发 | 运营可按版本配置，无需发版 |
| Modal Header | 不使用 | 用 Body 顶部自定义布局；自定义 ✕ 待定 |
| API 方案 | 扩展现有 version-info | 客户端已调用此 API，无需额外请求 |
| Dashboard | 复用自研后台 | 与 Banner / App Update 统一管理入口 |
| 状态管理 | 草稿→发布→下线 | 支持提前配置、按需发布、紧急下线 |
