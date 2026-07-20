# OneKey Pro 2 Portfolio 当前实现说明

## 文档信息

| 项目 | 内容 |
| --- | --- |
| 文档类型 | 产品现状说明书 |
| 适用对象 | 产品、App、服务端、硬件 SDK、固件、测试 |
| 功能范围 | OneKey App 向 OneKey Pro 2 同步 Portfolio 资产摘要 |
| 实现范围 | 当前 `app-monorepo` 与已安装硬件 SDK 的实际实现 |
| 不包含 | 未来方案、改造排期、交互重设计、服务端内部实现细节 |
| 文档状态 | 当前实现快照 |
| 更新时间 | 2026-07-17 |

## 1. 文档目的

本文档用于说明 OneKey App 当前如何生成、打包并向 OneKey Pro 2 传输 Portfolio 数据，以及该功能在产品层面的触发方式、数据范围、状态流转、限制和用户可见结果。

本文档重点回答以下问题：

- Portfolio 在什么情况下触发同步。
- App 会收集和发送哪些账户及资产信息。
- 最多会向硬件同步多少个币种，以及币种如何选择。
- App、服务端、硬件 SDK 和固件分别承担什么职责。
- 同步过程中有哪些去重、冷却、连接状态和忙碌状态限制。
- 用户在设备端可能看到什么结果。
- 当前实现与固件契约之间存在哪些已经可识别的差异。

## 2. 产品结论摘要

当前 Portfolio 同步具有以下核心特征：

1. 当前功能仍受 Pro 2 测试模式和开发开关控制，不是默认对所有正式用户开放的常规生产功能。
2. App 从“全部网络”资产列表中取得已经排序的资产快照，最多选择前 10 个币种生成 Portfolio。
3. 进入 Portfolio 的币种通常按照法币价值从高到低排列；无价值或零价值资产位于有价值资产之后。
4. App 不直接把裸 JSON 写入硬件，而是先把 `portfolio.json` 提交给 OneKey 服务端。
5. 服务端负责校验、规范化、补充图标信息、生成签名 Portfolio 包，并以 Base64 返回给 App。
6. App 将服务端返回内容解码为二进制 `packageBytes`，再调用硬件 SDK 的 `uploadPortfolio()`。
7. 硬件 SDK 使用 `FilesystemFileWrite` 分块写入候选文件，完成后发送 `PortfolioUpdate`，只有硬件返回成功才算同步完成。
8. 硬件设备上展示的是资产摘要，不是完整钱包资产数据库；当前最多包含 10 个币种。
9. 当前 `totalFiat` 是已选择的前 10 个币种价值之和，不是账户所有资产的完整总价值。
10. 当前存在暂存路径、时间戳单位、可空字段和聚合币网络字段等契约差异，需要在联调和验收时重点关注。

## 3. 功能范围与产品定位

### 3.1 功能目标

Portfolio 同步用于把 App 中的账户资产摘要发送到 OneKey Pro 2，使设备能够在 Portfolio 首页或详情页面显示：

- 当前账户标识。
- 当前展示法币及货币符号。
- 已同步资产价值合计。
- 最多 10 个主要币种。
- 每个币种的余额、价格、法币价值、网络和资产类型等信息。
- 数据更新时间。

### 3.2 当前不是完整资产镜像

当前同步数据并不等于 App 中的全部资产明细，主要差异包括：

- 最多同步 10 个币种。
- 不包含 NFT、DeFi 仓位、质押仓位和风险资产列表等其他资产形态。
- 不包含交易历史、地址簿、链上交易状态或收益明细。
- 不包含完整账户地址，通常只包含账户编号或缩短后的地址。
- 不包含 App 内部的 `walletId`、`connectId` 等运行时标识。

### 3.3 当前功能开关

同步逻辑只有在以下条件满足时才会运行：

1. 开发设置处于启用状态。
2. Pro 2 Test Mode 已开启。
3. `enablePortfolioSyncDev` 已明确开启。开发或 E2E 环境不会隐式启用该模块。

如果没有开启 Pro 2 Test Mode，Portfolio 同步直接返回 `disabled`，不会构造数据、请求服务端或上传硬件。

## 4. 参与系统与职责边界

| 系统 | 当前职责 |
| --- | --- |
| App 主界面运行时 | 拉取并合并全部网络资产，计算排序后的资产列表，发出资产列表已稳定事件 |
| App 后台服务 `kit-bg` | 监听事件、执行开关检查、冷却、去重、连接检查、构造 Portfolio JSON、请求服务端、调用硬件 SDK |
| OneKey Wallet 服务端 | 接收 `portfolio.json`，校验和规范化数据，重新计算可信 `iconName`，打包并签名，返回 Base64 包 |
| 硬件 SDK | 将签名包分块写入 Pro 2，完成后发送 `PortfolioUpdate` |
| Pro 2 固件 | 校验签名包、解析 JSON、更新内存、持久化有效包、通知 Portfolio 界面刷新 |

### 4.1 运行时说明

在 iOS、Android 和浏览器扩展中，App 主界面和后台服务属于隔离的 JavaScript 运行时：

- 主界面运行时负责形成资产快照和发出事件。
- 后台运行时负责实际构造 JSON、访问服务端和调用硬件 SDK。
- 两个运行时独立初始化，不能假设一方启动后另一方已经准备完成。

在 Desktop 和 Web 中，主界面与后台业务代码处于单一 JavaScript 运行时，但仍保持相同的服务边界和调用方式。

## 5. 端到端业务流程

当前完整流程如下：

1. App 完成“全部网络”资产请求和合并。
2. App 对资产列表去重并按照法币价值排序。
3. App 发出 `AllNetworksTokenListSettled` 事件。
4. 后台 Portfolio 服务对事件执行 1 秒防抖。
5. 后台检查 Portfolio 开关是否启用。
6. 后台判断当前钱包是否为硬件钱包，并取得设备连接 ID。
7. 对硬件设备检查 20 秒传输冷却时间。
8. 取得 App 当前展示法币和汇率表。
9. 从排序后的资产中取前 10 个币种。
10. 构造账户、总金额和 Token 字段。
11. 将所有 Token 的 `iconName` 清空为 `null`，交由服务端重新计算。
12. 使用稳定序列化生成 `portfolio.json`。
13. 计算不包含时间戳的内容哈希，用于去重。
14. 检查相同设备是否已经同步或正在同步相同内容。
15. 上传前检查设备是否仍连接、硬件通道是否忙碌。
16. App 请求 `/wallet/v1/hardware/portfolio/pack`。
17. 服务端返回签名包 `packageBase64`。
18. App 将 Base64 解码为独立的 `ArrayBuffer`。
19. 上传前再次检查设备连接和硬件忙碌状态。
20. App 调用硬件 SDK 的 `uploadPortfolio(connectId, { packageBytes })`。
21. SDK 以 2048 字节为默认分块大小写入候选文件。
22. 每个分块等待硬件返回 `FilesystemFile` 确认后才继续。
23. 文件传输完成后，SDK 发送空的 `PortfolioUpdate` 请求。
24. 固件验证签名包、解析 Portfolio、提交内存和持久化数据。
25. 固件返回 `Success` 后，SDK 返回 `portfolioUpdated: true`。
26. App 保存内容哈希和本次传输时间，并记录状态为 `uploaded`。

## 6. 同步触发机制

### 6.1 触发事件

Portfolio 同步以 `AllNetworksTokenListSettled` 为数据入口。该事件表示当前账户的全部网络资产请求已经形成权威合并快照。

事件携带的主要信息包括：

- 账户 ID、账户名称和账户地址。
- 索引账户 ID、名称和索引序号。
- 钱包 ID 和钱包类型。
- 硬件设备连接 ID。
- 当前网络和数据所有者信息。
- 已排序 Token 列表。
- Token 对应余额、价格和法币价值映射。
- 聚合资产映射。

### 6.2 1 秒防抖

后台监听到事件后不会立即执行，而是进行 1 秒防抖。短时间内连续产生的多个已稳定事件会合并为最后一次执行，以避免频繁请求服务端和硬件。

### 6.3 硬件钱包与普通钱包差异

当前开发流程会为收到的事件构造 Portfolio 并请求服务端，但只有同时满足以下条件时才会上传硬件：

- 当前钱包被识别为硬件钱包。
- 事件中存在 `deviceConnectId`。

如果不是硬件钱包，流程可以完成数据构造和服务端打包，但最终状态为 `built`，不会执行设备上传。

## 7. 币种来源、排序与数量限制

### 7.1 数据来源

Portfolio 使用 App “全部网络”首页资产列表形成的 `snapshot.orderedTokens`，而不是单独请求一套 Portfolio 专用资产接口。

### 7.2 排序规则

形成资产快照时，App 当前执行以下排序：

1. 合并各网络普通资产和小额资产。
2. 按 Token 唯一键去重。
3. 按法币价值从高到低排序。
4. 找到法币价值不可用或为零的位置。
5. 有价值资产保持法币价值排序。
6. 零价值资产按 Token 自身顺序规则重新排序，并放在有价值资产之后。

因此，Portfolio 选择的前 10 个币种通常是当前账户法币价值最高的 10 个资产。

### 7.3 数量限制

App 在构造 Portfolio 时执行：

```ts
tokens.slice(0, 10)
```

实际传输数量为：

```text
min(当前可用币种数量, 10)
```

对应产品行为：

| App 中币种数量 | 实际同步数量 |
| ---: | ---: |
| 0 | 0 |
| 1 | 1 |
| 5 | 5 |
| 10 | 10 |
| 11 | 10 |
| 100 | 10 |

`tokenCount` 表示实际进入 `tokens` 数组的数量，不表示截断前总币种数。

### 7.4 零资产账户

当前数据构造允许：

```json
{
  "tokenCount": 0,
  "tokens": []
}
```

从产品语义上，这是“账户已同步，但当前资产为零”，不同于设备从未收到过 Portfolio 数据。

## 8. App 生成的完整数据结构

App 生成的 Portfolio 根对象固定包含 8 个字段：

```ts
type IPortfolioPayload = {
  v: 1;
  ts: number;
  currency: string;
  currencySymbol: string;
  account: {
    label: string;
    addressMasked: string;
  };
  totalFiat: string | null;
  tokenCount: number;
  tokens: IPortfolioPayloadToken[];
};
```

## 9. 根字段产品字典

| 字段 | 类型 | 当前生成规则 | 产品含义 |
| --- | --- | --- | --- |
| `v` | 整数 | 固定为 `1` | Portfolio JSON 结构版本 |
| `ts` | 数字 | 当前传入 `Date.now()` | 本次数据生成时间 |
| `currency` | 字符串 | App 当前展示法币的 ID | 资产金额使用的法币单位，如 `usd`、`cny` |
| `currencySymbol` | 字符串 | App 当前展示法币的符号 | 设备金额前显示的符号，如 `$`、`¥` |
| `account` | 对象 | 根据当前账户信息生成 | 设备端显示的账户身份摘要 |
| `totalFiat` | 字符串或 `null` | 前 10 个 Token 的 `fiatValue` 之和；任一 Token 无法换算时为 `null` | 设备端 Portfolio 中央总金额 |
| `tokenCount` | 整数 | `tokens.length` | 本次实际同步币种数，范围为 0 到 10 |
| `tokens` | 数组 | 已排序资产的前 10 项 | 设备端展示和绘制资产分布的数据 |

### 9.1 时间戳现状

当前同步流程使用 `Date.now()`，实际产生的是毫秒级时间戳，例如：

```text
1784260000000
```

当前固件契约示例使用的是秒级时间戳，例如：

```text
1784260000
```

因此当前 App 实际值和固件契约示例存在单位差异。本文档仅记录现状，不对最终解释方式作目标方案定义。

### 9.2 totalFiat 现状

`totalFiat` 的计算范围是已经截断的前 10 个 Token：

- 如果前 10 个 Token 都具有可用法币价值，则累加并输出十进制字符串。
- 如果任意一个 Token 的法币价值转换失败，则整个 `totalFiat` 输出 `null`。
- 排名第 11 及之后的资产不会计入 `totalFiat`。

这意味着设备显示的总金额当前更接近“已同步的主要资产合计”，而不是 App 首页完整账户总资产。

## 10. account 字段产品字典

`account` 固定包含两个字段，不会携带额外属性。

| 字段 | 类型 | 当前生成规则 | 示例 |
| --- | --- | --- | --- |
| `label` | 字符串 | 依次使用 `indexedAccountName`、`accountName`、`accountId`，全部缺失时为空字符串 | `Trading Account` |
| `addressMasked` | 字符串 | 有索引序号时为 `Account #序号`；没有索引序号时使用缩短后的账户地址 | `Account #1` 或 `0x1234...abcd` |

### 10.1 字段命名与实际内容

当前实现中，`addressMasked` 不一定是地址：

- 对常见的 HD/HW 索引账户，值通常是 `Account #1`、`Account #2` 等账户编号。
- 只有没有索引序号时，才会使用缩短后的账户地址。

## 11. Token 字段产品字典

每个 Token 固定包含 11 个字段。

```ts
type IPortfolioPayloadToken = {
  symbol: string;
  name: string;
  contractAddress: string;
  iconName: string | null;
  isAllNetworks: boolean;
  isNative: boolean;
  balance: string;
  fiatValue: string | null;
  price: number | null;
  change24h: number | null;
  networkId: string;
};
```

| 字段 | 类型 | 当前生成规则 | 产品含义 |
| --- | --- | --- | --- |
| `symbol` | 字符串 | `commonSymbol` 优先，否则使用 `symbol` | 币种简称，如 BTC、ETH、USDT |
| `name` | 字符串 | `token.name` | 币种完整名称 |
| `contractAddress` | 字符串 | 根据聚合币、原生币和网络类型规范化 | 资产合约或原生资产标识 |
| `iconName` | 字符串或 `null` | App 本地可计算；提交服务端前统一改为 `null` | 服务端最终决定的设备图标别名 |
| `isAllNetworks` | 布尔值 | `Boolean(token.isAggregateToken)` | 是否为跨网络聚合资产 |
| `isNative` | 布尔值 | 聚合资产固定为 `false`；否则取 Token 原生币标记 | 是否为当前网络原生资产 |
| `balance` | 字符串 | `balanceParsed`；缺失时为 `"0"` | 用户持有的可读余额 |
| `fiatValue` | 字符串或 `null` | 转换为当前展示法币后的资产价值 | 用户该币种持仓的法币价值 |
| `price` | 数字或 `null` | 转换为当前展示法币后的单币价格 | 当前币价 |
| `change24h` | 数字或 `null` | `price24h`；缺失时为 `null` | 过去 24 小时价格变化百分比 |
| `networkId` | 字符串 | 聚合资产为空字符串；普通资产使用 Token 网络 ID | 资产所属网络 |

## 12. Token 字段详细规则

### 12.1 symbol

App 优先使用跨网络统一符号 `commonSymbol`，没有时使用资产自身 `symbol`。

示例：

- 原始 Token `symbol = "WETH"`，如果存在 `commonSymbol = "ETH"`，则同步 `ETH`。
- 没有 `commonSymbol` 时直接同步原始符号。

### 12.2 contractAddress

当前处理规则如下：

| Token 类型 | `contractAddress` |
| --- | --- |
| 全网络聚合资产 | 空字符串 |
| 大多数网络的原生币 | 空字符串 |
| Aptos、Sui 原生资产 | 如果存在地址，保留规范化后的地址 |
| 普通合约 Token | 传规范化后的合约地址 |

### 12.3 iconName

App 本地 Mock Portfolio 会根据币种、网络、是否原生资产和合约地址尝试计算 `iconName`。

但是实际提交服务端的 Portfolio 会把所有 Token 的 `iconName` 改成 `null`。当前代码约定由服务端使用自己的可信图标白名单重新计算。

因此：

- App 本地计算的图标不是硬件最终图标的可信来源。
- App 无法仅根据提交前 JSON 判断硬件最终会收到哪个 `iconName`。
- 硬件最终收到的值取决于服务端打包内容。

### 12.4 isAllNetworks

当 Token 是聚合资产时为 `true`。聚合资产表示 App 将多个网络上的同类资产合并为一条资产记录。

聚合资产当前同时具有以下行为：

- `isAllNetworks = true`
- `isNative = false`
- `contractAddress = ""`
- `networkId = ""`

### 12.5 balance

使用已经按照 Token 精度解析后的余额字符串 `balanceParsed`。如果不存在对应资产数据，则回退为 `"0"`。

### 12.6 fiatValue

`fiatValue` 表示用户该 Token 持仓的法币价值。App 会将资产原始法币价值转换成当前 App 展示法币。

转换逻辑为：

```text
目标法币金额 = 原始金额 / 原始法币汇率 × 目标法币汇率
```

以下情况返回 `null`：

- 原始金额不存在或为空。
- 原始金额不是有限数字。
- 原始法币汇率不存在、为零或不是有限数字。
- 目标法币汇率不存在、为零或不是有限数字。

如果没有原始法币标识，当前实现直接把原始金额视为目标法币金额。

### 12.7 price

`price` 使用与 `fiatValue` 相同的法币转换逻辑，但最终转换为 JavaScript 数字。

### 12.8 change24h

直接使用资产数据中的 `price24h`。没有值时输出 `null`。当前固件界面不一定展示该字段，但当前 JSON 结构仍会携带它。

### 12.9 networkId

普通资产使用 App 内部网络 ID，例如：

- `btc--0`
- `evm--1`
- `sol--101`

全网络聚合资产当前输出空字符串。

## 13. 展示法币与汇率获取

后台构造 Portfolio 时会读取 App 当前设置中的 `currencyInfo`：

- `currencyInfo.id` 用于 `currency`。
- `currencyInfo.symbol` 用于 `currencySymbol`。

如果本地汇率表中不存在当前展示法币，后台会尝试重新请求货币列表。请求失败不会立即终止构造，但相关 Token 的换算结果可能变成 `null`。

## 14. App 提交给服务端的数据

### 14.1 请求地址

App 当前请求：

```text
POST /wallet/v1/hardware/portfolio/pack
```

请求体就是稳定序列化前的 Portfolio 对象。

### 14.2 提交前变更

App 在提交服务端前执行以下变更：

```ts
tokens: portfolio.tokens.map((token) => ({
  ...token,
  iconName: null,
}))
```

除 `iconName` 外，根字段、账户字段和其他 Token 字段保持 App 构造结果。

### 14.3 服务端返回结构

App 当前只读取以下返回字段：

```json
{
  "data": {
    "packageBase64": "..."
  }
}
```

如果 `packageBase64` 缺失，App 将本次同步标记为错误，不会调用硬件 SDK。

### 14.4 服务端职责的当前代码约定

App 代码注释明确约定服务端负责：

- 校验 Portfolio JSON。
- 规范化字段。
- 根据服务端图标白名单重新计算 `iconName`。
- 生成 Portfolio 包。
- 使用生产密钥体系签名。
- 返回 Base64 编码后的完整包。

服务端内部实现不在当前仓库中，因此本文档无法从 App 代码确认服务端最终对每个字段执行了何种补齐或修改。

## 15. 内容哈希与重复同步控制

### 15.1 内容哈希

App 使用稳定 JSON 序列化和 SHA-256 计算 Portfolio 内容哈希。

计算哈希时会排除 `ts`：

```ts
const { ts, ...content } = portfolio;
hash(content);
```

因此只有时间变化、其他资产内容完全相同的 Portfolio 被视为相同内容。

### 15.2 去重范围

去重状态按同步目标保存：

- 有设备连接 ID 时，以设备 `connectId` 为目标键。
- 没有设备连接 ID 时，以 `walletId` 为目标键。

当前会同时检查：

- 上次成功处理后持久化的内容哈希。
- 当前运行时正在上传的内容哈希。

如果任一匹配，本次状态为 `duplicate`，不会再次请求硬件上传。

### 15.3 去重提交时机

只有在流程真正完成后才会持久化内容哈希：

- 硬件钱包必须成功上传后才提交。
- 非硬件钱包必须完成服务端打包后才提交。

设备断开、硬件忙碌或流程报错时不会持久化本次哈希，因此相同资产快照后续仍可重试。

## 16. 20 秒传输冷却

硬件设备上传成功后，App 按设备记录最后传输时间。

在随后 20 秒内收到新的资产快照时：

- 不立即上传。
- 状态记录为 `cooldown`。
- 保存最新的待同步事件。
- 重置定时器。
- 冷却结束后使用最新事件自动重试。

冷却机制按设备隔离，多台同时连接的设备分别维护自己的时间窗口。

## 17. 设备连接和硬件忙碌检查

对于硬件钱包，当前流程执行两轮状态检查。

### 17.1 服务端请求前

检查：

- 设备连接是否仍有效。
- 硬件交互通道是否忙碌。

如果设备断开，状态为 `device-disconnected`。

如果硬件正在处理签名、设置或其他交互，状态为 `hardware-busy`。

### 17.2 服务端返回后、设备上传前

由于服务端请求耗时期间设备状态可能变化，App 会再次并行检查连接和忙碌状态。

只有两项检查均通过才会调用 `uploadPortfolio()`。

### 17.3 交互特点

当前上传使用 `BACKGROUND_NON_INTERACTIVE` 上下文：

- 不把 Portfolio 上传视为用户主动发起的硬件交互。
- 当前固件契约不要求 Portfolio 专用 PIN 确认。
- SDK 设置了设备锁定时重试解锁策略。

## 18. App 最终传给硬件 SDK 的信息

App 调用硬件 SDK 时只传递：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `connectId` | 字符串 | 经过传输兼容转换后的目标设备连接 ID |
| `packageBytes` | `ArrayBuffer` | 服务端返回 Base64 解码后的完整签名 Portfolio 包 |

以下信息不会作为独立 SDK 参数传输：

- `walletId`
- `accountId`
- 完整 Token 列表对象
- 账户地址
- 展示法币
- 内容哈希

这些业务数据已经位于签名包内部，SDK 将其视为不透明二进制数据。

## 19. 硬件 SDK 分块传输字段

当前已安装 SDK 使用 `uploadPortfolio()`，内部转换为文件写入参数：

| 字段 | 当前值或规则 |
| --- | --- |
| `path` | `vol1:/portfolio/portfolio.okpkg.pending` |
| `offset` | 从 `0` 开始，按硬件确认进度递增 |
| `data` | 完整 `packageBytes` |
| `chunkSize` | `2048` 字节 |
| `overwrite` | 第一块 `true`，后续块 `false` |
| `append` | `false` |
| `emitProgress` | `false`，App 不展示 SDK 上传进度 UI |
| `timeoutMs` | App 当前未显式传递 |
| `unlockPolicy` | `retry-on-locked` |

SDK 对每一个分块发送以下协议结构：

```text
FilesystemFileWrite {
  file: {
    path,
    offset,
    total_size,
    data
  },
  overwrite,
  append,
  ui_percentage
}
```

### 19.1 分块确认

每发送一个分块，SDK 都会等待硬件返回 `FilesystemFile`。

SDK 读取硬件返回的 `processed_byte` 并检查：

- 必须是有效数字。
- 必须大于本次分块开始偏移量。
- 不能超过本次分块结束位置。

如果返回进度不合法，SDK 终止上传并返回错误。

### 19.2 PortfolioUpdate

完成所有文件分块写入后，SDK发送：

```text
PortfolioUpdate {}
```

只有收到 `Success` 后，SDK 才返回：

```json
{
  "portfolioUpdated": true
}
```

单纯完成文件写入不代表 Portfolio 已经更新。

## 20. 硬件端数据应用语义

按照当前固件契约，`PortfolioUpdate` 成功意味着固件已经完成：

1. 找到候选 Portfolio 文件。
2. 校验包类型、版本和签名。
3. 解包唯一的 `portfolio.json`。
4. 校验 JSON 字段和数量限制。
5. 解析并构建内存 Portfolio。
6. 原子替换之前持久化的有效 Portfolio 包。
7. 提交新的内存数据。
8. 通知 Portfolio 首页和详情界面刷新。
9. 返回 `Success`。

如果新包无效：

- 新候选数据不会替换旧数据。
- 之前有效的 Portfolio 继续保留。
- App 收到上传失败。

## 21. 设备端展示语义

### 21.1 总金额

设备中央金额使用：

- `totalFiat`
- `currencySymbol`

### 21.2 Token 排序

虽然 App 已经按法币价值排序，固件当前仍会再次排序：

1. 按 `fiatValue` 降序。
2. 法币价值相同时，按不区分大小写的 `symbol` 排序。

因此，硬件最终顺序可能覆盖 App 对同价值资产的原始顺序。

### 21.3 图标与剩余数量

设备首页当前主要展示前三个 Token 图标。由于 `tokenCount` 最大为 10，剩余数量标记最大为 `+7`。

### 21.4 资产分布环

固件使用以下值作为图表总额：

```text
max(totalFiat, sum(tokens[].fiatValue))
```

占比过小的 Token 分段可能被合并到 Other 区域。

### 21.5 时间显示

固件将 `ts` 显示为 `MM-DD HH:mm`。当前固件不主动应用 App 设置的时区转换，最终时间含义取决于生产者传入的时间戳语义。

### 21.6 Portfolio 关闭时上传

如果用户在设备上关闭 Portfolio 显示：

- 上传和校验仍可以完成。
- 有效签名包仍会持久化。
- 用户后续开启 Portfolio 时加载并显示已保存数据。

## 22. 用户可见状态

### 22.1 已同步且有资产

设备显示：

- 总法币金额。
- 当前货币符号。
- 主要 Token 图标。
- Portfolio 详情中的 Token 数据。
- 更新时间。

### 22.2 已同步但资产为零

当 `tokenCount = 0` 且 `tokens = []` 时，这是有效的零资产 Portfolio。

产品语义是：

```text
同步已经完成，账户当前没有可展示资产。
```

### 22.3 从未同步或没有有效文件

设备没有有效 Portfolio 文件时，显示 `Sync your portfolio` 引导状态。

这与“已同步零资产”是两个不同状态。

### 22.4 上传失败

上传失败时：

- App 不会提交新的去重哈希。
- 相同资产内容后续仍有机会重试。
- 设备保留上一次有效 Portfolio。
- 当前实现没有为用户定义独立的 Portfolio 错误页面，主要通过开发日志和内部状态记录错误。

## 23. App 内部同步状态

当前后台服务记录以下状态：

| 状态 | 含义 |
| --- | --- |
| `disabled` | Portfolio 开关未启用 |
| `cooldown` | 设备仍处于 20 秒冷却时间 |
| `duplicate` | 内容与上次成功结果或正在上传内容相同 |
| `device-disconnected` | 目标硬件已经断开 |
| `hardware-busy` | 硬件通道正在处理其他任务 |
| `built` | 非硬件钱包完成数据构建和服务端打包，但未上传设备 |
| `uploaded` | 服务端打包和硬件 `PortfolioUpdate` 均成功 |
| `error` | 构建、服务端请求、解码或硬件上传发生错误 |

开发状态结果还会记录：

- 内容哈希。
- 设备连接 ID。
- 钱包 ID。
- 实际同步 Token 数量。
- 截断前 Token 数量。
- JSON 字节数。
- 服务端包字节数。
- 上传结果。
- 更新时间。
- 错误信息。

这些调试字段不会进入 Portfolio JSON，也不会发送给硬件。

## 24. 数据与隐私范围

### 24.1 服务端可接收到的信息

App 向服务端提交的 Portfolio JSON 包含：

- 账户名称或账户 ID 回退值。
- 账户编号或缩短地址。
- 当前展示法币。
- 前 10 个资产的币种、余额、价格、法币价值和网络。
- 资产合约地址。
- 24 小时价格变化。
- 数据生成时间。

这属于用户资产和持仓摘要数据，应按照敏感财务数据处理。

### 24.2 不进入 JSON 的运行时信息

以下字段用于 App 内部路由和状态控制，但不会进入 Portfolio JSON：

- `walletId`
- `deviceConnectId`
- `indexedAccountId`
- `ownerAccountId`
- `ownerNetworkId`
- 截断前完整 Token 数量
- 内容哈希
- 冷却剩余时间
- 上传状态和错误信息

### 24.3 硬件侧存储

固件保存的是签名 Portfolio 包，不会长期保存解密后的独立明文 JSON 文件。JSON 在内存中解包和解析后，临时提取缓冲区会被清理。

Portfolio 包是签名的，但不是加密的。

## 25. 当前实现限制

### 25.1 最多 10 个 Token

App 和固件契约都限制最多 10 个 Token。第 11 个及之后的资产不会进入硬件 Portfolio。

### 25.2 totalFiat 只覆盖前 10 个 Token

当前总额计算发生在 Token 截断之后，因此不包含其他未同步资产。

### 25.3 App 依赖服务端生成最终包

App 无法自行完成生产包签名。服务端不可用、响应缺少 `packageBase64` 或返回无效包时，设备同步无法完成。

### 25.4 最终 iconName 对 App 不透明

App 提交服务端时将 `iconName` 设为 `null`，最终图标依赖服务端处理结果。

### 25.5 当前没有 Portfolio 专用用户错误反馈

错误主要记录在后台状态和开发日志中，普通用户不一定能直接知道未同步原因。

### 25.6 删除文件不会立即清除当前界面

按照当前固件行为，通用文件删除只能删除持久化包，不会立即清空已经加载到内存中的 Portfolio，也不会立即刷新当前界面。设备或应用重启后才会进入无文件状态。

### 25.7 传输能力范围

当前固件契约明确验证的是 USB 主机路径。BLE 或 Bridge 下的碎片化和稳定性仍属于需要单独验证的能力范围。

## 26. 当前实现与固件契约差异

本节只记录当前可观察到的差异及其产品影响，不定义改造方案。

### 26.1 候选文件路径不一致

当前硬件 SDK 使用：

```text
vol1:/portfolio/portfolio.okpkg.pending
```

当前固件契约要求：

```text
vol1:/portfolio/portfolio.pfol.pending
```

如果目标固件严格按照契约路径查找候选文件，`PortfolioUpdate` 可能无法找到 SDK 已上传的数据，最终同步失败。

### 26.2 时间戳单位差异

当前 App 传入 `Date.now()`，属于毫秒级时间戳；固件契约示例使用秒级时间戳。

潜在产品表现是设备端时间异常或无法按预期解释更新时间。

### 26.3 App 可空字段与固件严格校验不一致

当前 App 类型和构造逻辑允许以下值为 `null`：

- `totalFiat`
- `fiatValue`
- `price`
- `change24h`
- 提交服务端时的 `iconName`

当前固件 v1 契约要求这些字段最终不得为 `null`。因此最终包能否通过固件校验依赖服务端规范化和补齐。

### 26.4 聚合资产 networkId 为空

当前 App 对全网络聚合资产发送：

```json
{
  "isAllNetworks": true,
  "networkId": ""
}
```

当前固件契约要求 `networkId` 为非空字符串。最终能否被固件接受依赖服务端处理结果或固件实际版本行为。

### 26.5 iconName 的中间数据不符合固件最终要求

App 提交服务端时所有 Token 的 `iconName` 都是 `null`；固件要求最终包中的 `iconName` 非空。当前职责约定是由服务端重新计算。

### 26.6 当前生产安全能力仍依赖外部完成度

固件契约记录的当前状态包括：

- 生产 Ed25519 公钥和私钥托管体系需要完整配置。
- 当前没有实际的单调防重放校验。
- 包具备签名完整性和真实性校验，但不能据此声称已经具备完整生产防重放保护。

## 27. 失败场景与当前结果

| 失败场景 | App 当前结果 | 硬件当前结果 |
| --- | --- | --- |
| 功能开关关闭 | `disabled` | 不发起同步 |
| 20 秒冷却中 | `cooldown`，保存最新事件等待重试 | 保持原数据显示 |
| 内容重复 | `duplicate` | 不重复上传 |
| 设备断开 | `device-disconnected` | 保持原数据显示 |
| 硬件忙碌 | `hardware-busy` | 保持原数据显示 |
| 汇率缺失 | 相关金额或价格可能为 `null` | 最终包可能被服务端或固件拒绝 |
| 服务端不可用 | `error` | 不发起上传 |
| 服务端缺少 Base64 包 | `error` | 不发起上传 |
| Base64 解码失败 | `error` | 不发起上传 |
| 文件分块确认异常 | `error` | 保留旧 Portfolio |
| PortfolioUpdate 校验失败 | `error` | 删除无效候选，保留旧 Portfolio |
| 成功响应丢失 | App 可能认为失败 | 固件可能已经成功；契约定义重复 `PortfolioUpdate` 应幂等成功 |

## 28. 产品验收观察清单

以下清单用于确认“当前实现是否按现有代码工作”，不代表未来目标要求。

### 28.1 开关与触发

- [ ] 未开启 Pro 2 Test Mode 时不触发 Portfolio 同步。
- [ ] 开启测试模式和 Portfolio Sync Dev 后，全部网络资产稳定时触发同步。
- [ ] 连续资产事件经过 1 秒防抖，只处理最后一次有效事件。

### 28.2 数据范围

- [ ] 账户不足 10 个币种时，发送实际数量。
- [ ] 账户超过 10 个币种时，只发送排序后的前 10 个。
- [ ] `tokenCount` 与 `tokens.length` 一致。
- [ ] 截断前总币种数只记录在调试状态，不进入硬件数据。
- [ ] 零资产账户生成 `tokenCount = 0` 和空数组。

### 28.3 字段检查

- [ ] `v` 固定为 `1`。
- [ ] `currency` 和 `currencySymbol` 使用 App 当前展示法币。
- [ ] HD/HW 索引账户的 `addressMasked` 通常为 `Account #N`。
- [ ] 原生币和聚合资产按规则清空合约地址。
- [ ] 提交服务端前 `iconName` 为 `null`。
- [ ] `totalFiat` 为已同步 Token 价值之和。

### 28.4 状态控制

- [ ] 相同内容不会重复上传。
- [ ] 上传成功后 20 秒内的新事件进入冷却队列。
- [ ] 设备断开时不上传。
- [ ] 硬件忙碌时不上传，并允许相同内容后续重试。
- [ ] 服务端返回后上传前会再次检查设备状态。

### 28.5 硬件结果

- [ ] 文件传输完成后确实发送 `PortfolioUpdate`。
- [ ] 只有 `PortfolioUpdate` 返回成功才记录 `uploaded`。
- [ ] 无效新包不会覆盖设备上一次有效 Portfolio。
- [ ] Portfolio 显示关闭时上传仍可持久化。
- [ ] 重新开启 Portfolio 后可以加载之前已上传的数据。

### 28.6 契约差异验证

- [ ] 确认实际固件接受的候选文件路径。
- [ ] 确认实际固件对 `ts` 的时间单位解释。
- [ ] 确认服务端会补齐所有固件不接受的 `null` 字段。
- [ ] 确认服务端或固件如何处理聚合资产空 `networkId`。

## 29. 示例：App 提交服务端的 Portfolio JSON

以下示例用于展示当前 App 请求体结构，其中 `iconName` 已在提交前被清空：

```json
{
  "v": 1,
  "ts": 1784260000000,
  "currency": "usd",
  "currencySymbol": "$",
  "account": {
    "label": "Account #1",
    "addressMasked": "Account #1"
  },
  "totalFiat": "12500.32",
  "tokenCount": 2,
  "tokens": [
    {
      "symbol": "BTC",
      "name": "Bitcoin",
      "contractAddress": "",
      "iconName": null,
      "isAllNetworks": false,
      "isNative": true,
      "balance": "0.1",
      "fiatValue": "10000",
      "price": 100000,
      "change24h": 1.25,
      "networkId": "btc--0"
    },
    {
      "symbol": "USDT",
      "name": "Tether USD",
      "contractAddress": "0xdac17f958d2ee523a2206206994597c13d831ec7",
      "iconName": null,
      "isAllNetworks": false,
      "isNative": false,
      "balance": "2500.32",
      "fiatValue": "2500.32",
      "price": 1,
      "change24h": 0.01,
      "networkId": "evm--1"
    }
  ]
}
```

说明：该示例展示 App 提交服务端的中间数据，不代表服务端最终签名包内的 JSON 一定保持完全相同。服务端按照当前职责约定会执行规范化和图标补齐。

## 30. 实现依据

本文档基于以下当前代码和契约整理：

| 范围 | 文件 |
| --- | --- |
| Portfolio 字段类型与构造 | `packages/shared/src/utils/portfolioPayload.ts` |
| Portfolio 本地归档 | `packages/shared/src/utils/portfolioArchive.ts` |
| App Portfolio 构建与服务端提交转换 | `packages/kit-bg/src/services/ServiceHardware/serviceHardwarePortfolioSync/serviceHardwarePortfolioSyncUtils.ts` |
| 同步状态、冷却、去重、服务端请求和上传 | `packages/kit-bg/src/services/ServiceHardware/serviceHardwarePortfolioSync/ServiceHardwarePortfolioSync.ts` |
| App 到硬件 SDK 包装 | `packages/kit-bg/src/services/ServiceHardware/ServiceHardware.ts` |
| 全部网络资产事件来源 | `packages/kit/src/views/Home/components/TokenListBlock/TokenListBlock.tsx` |
| 全部网络资产排序和合并 | `packages/kit/src/views/Home/components/TokenListBlock/buildMergedAllNetworkSnapshot.ts` |
| SDK Portfolio 上传 | `node_modules/@onekeyfe/hd-core/src/api/UploadPortfolio.ts` |
| SDK 文件分块传输 | `node_modules/@onekeyfe/hd-core/src/api/helpers/protocolV2FileWrite.ts` |
| 固件兼容契约 | `send-pro2-portfolio/references/firmware-contract-v1.md` |

## 31. 当前实现一句话定义

当前 OneKey Pro 2 Portfolio 是一个受开发开关控制的后台资产摘要同步能力：App 从全部网络资产中选择价值排序后的前 10 个 Token，将账户、法币金额和 Token 明细提交服务端生成签名包，再由硬件 SDK 分块上传并通过 `PortfolioUpdate` 应用到设备。
