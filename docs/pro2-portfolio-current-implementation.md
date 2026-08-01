# Pro 2 Portfolio 当前实现

## 1. 文档范围

本文描述 OneKey App、Portfolio 打包服务和 Pro 2 Firmware 之间的当前数据契约与同步流程，重点覆盖：

- App 生成 Portfolio 展示数据的规则；
- App 与服务端之间的 JSON 接口；
- 服务端签包后的硬件上传流程；
- 金额字符串、Unicode、字体范围和 UTF-8 字节限制；
- 内容去重、冷却、设备忙碌和失败处理。

本文以以下实现为依据：

- App 当前分支中的 `portfolioPayload.ts` 和 Hardware Portfolio Sync 服务；
- `firmware-pro2` 远端 `dev` 分支的展示字符串协议；
- `@onekeyfe/hd-core` 当前 `uploadPortfolio()` 实现。

服务端源码不在本仓库中。本文中的服务端行为是 App 与 Firmware 对服务端的接口约束，不代表已审计服务端内部实现。

## 2. 核心结论

Portfolio 金额采用“App 格式化、Firmware 原样显示”的协议：

- App 决定 Token 选择、顺序、金额格式、法币前缀、标准名称和资产占比；
- 服务端校验数据、补齐可信 Token 元数据、生成并签名 Portfolio 包；
- Firmware 将金额和余额作为受长度限制的 UTF-8 展示字符串；
- Firmware 不解析金额、不添加币种符号、不重新格式化，也不根据金额排序；
- Firmware 使用独立的 `portfolioPercentage` 绘制环图和进度条。

因此以下值都是合法的展示字符串：

```text
$27,112.11
< $0.01
0.0₅41
EUR 1.00
```

`0.0₅41` 是 App 的前导零下标压缩表示，不是传统的 `4.1e-6` 指数表示。

## 3. Runtime 范围

Portfolio 构建、服务端提交和硬件上传由 `kit-bg` 执行。

### 3.1 iOS、Android 和浏览器扩展

- Runtime 范围：`bg`；
- `main` 与 `bg` 是隔离的 JS Runtime，不能假设共享 JS 对象或初始化顺序；
- Portfolio 事件从主业务状态进入后台服务后，在 `bg` 中构建和上传；
- 硬件 SDK 调用由后台 Hardware Service 管理。

### 3.2 Desktop 和 Web

- App 代码运行在单一 JS Runtime；
- Portfolio 仍通过后台 Service 接口执行，以保持跨平台调用模型一致。

## 4. 同步触发流程

当前流程监听 `AllNetworksTokenListSettled` 事件：

1. 全网络 Token 列表完成计算；
2. 后台服务对连续事件执行 1 秒防抖；
3. 检查 Portfolio 调试功能是否开启；
4. 检查账户是否为硬件钱包；
5. 根据当前账户、Token、法币和汇率构建 Portfolio；
6. 计算不包含 `ts` 的内容哈希；
7. 检查目标设备的重复内容、连接状态、硬件忙碌状态和 20 秒冷却；
8. 将 Portfolio JSON 提交给服务端签包；
9. 将服务端返回的包交给 Hardware SDK；
10. 文件写入完成后发送 `PortfolioUpdate`；
11. 只有设备返回 `Success` 才记录为上传成功。

当前同步目标键优先使用硬件 `connectId`，没有连接 ID 时使用 `walletId`。去重和冷却状态按目标设备隔离。

## 5. App 生成的数据结构

App 构建的根对象固定包含 7 个字段：

```ts
type IPortfolioPayload = {
  v: 1;
  ts: number;
  account: {
    label: string;
    addressMasked: string;
  };
  totalFiat: string;
  tokenCount: number;
  tokens: IPortfolioPayloadToken[];
  otherTokens: {
    count: number;
    fiat: string;
    portfolioPercentage: number;
  };
};
```

App 侧 Token 包含：

```ts
type IPortfolioPayloadToken = {
  symbol: string;
  name: string;
  contractAddress: string;
  iconName: string | null;
  isAllNetworks: boolean;
  isNative: boolean;
  balance: string;
  fiatValue: string;
  portfolioPercentage: number;
  networkId: string;
};
```

服务端提交前会将所有 `iconName` 设置为 `null`。服务端必须根据可信白名单生成最终 `iconName`，并补齐 Firmware 要求的 `color`。

## 6. 根字段规则

| 字段 | App 规则 |
| --- | --- |
| `v` | 固定为整数 `1` |
| `ts` | 毫秒时间戳；App 预先按当前时区调整展示语义 |
| `account.label` | 优先使用索引账户名称、账户名称或账户 ID |
| `account.addressMasked` | 索引账户使用 `Account #N`，否则使用缩短地址 |
| `totalFiat` | App 格式化后的完整法币展示字符串 |
| `tokenCount` | `tokens.length`，当前最大为 5 |
| `tokens` | 保持 App 已确定的顺序 |
| `otherTokens` | 未进入详细列表的资产汇总，固定排在最后 |

`currency` 和 `currencySymbol` 已从当前协议删除。法币展示信息直接包含在 `totalFiat`、`tokens[].fiatValue` 和 `otherTokens.fiat` 中。

## 7. Token 选择与顺序

App 使用上游 UI Token 顺序并取前 5 个：

```text
tokens.slice(0, 5)
```

Firmware 不再根据 `fiatValue` 重新排序，设备顺序与 App 传入顺序一致。

`otherTokens.count` 的计算方式为：

```text
max(trunc(totalTokenCount) - tokens.length, 0)
```

## 8. 金额格式化

### 8.1 首页总资产

`totalFiat` 沿用 App 首页总资产规则：使用当前货币单位、本地化分组符和小数符，固定保留两位小数并四舍五入。`0 < value < 0.01` 显示 `< {currency}0.01`，零值显示 `{currency}0.00`。

App 按 Pro 2 的 16dp Roobert Regular 字体和 350dp 可用宽度预估完整字符串。完整字符串不超过 47 UTF-8 字节且能够放下时直接下传；否则改为保留 4 位有效数字、使用 ASCII `e` 的科学计数法。Firmware 仍只接收原有 `totalFiat` 单字段，不解析或重新格式化。

示例：

```text
75.247                              → $75.25
123456789012.34                     → $123,456,789,012.34
123456789012345678901234567890.12   → $1.235e+29
0.009                               → < $0.01
```

### 8.2 详情法币金额

`tokens[].fiatValue` 和 `otherTokens.fiat` 使用 Pro 2 紧凑法币格式：保留两位小数，超过 1,000 后使用 `K/M/B/T/Q`，并在单位边界四舍五入后自动提升。

### 8.3 Token 余额

`tokens[].balance` 使用 App 的 `formatBalance()`：

- 大于等于 1 时沿用 App 单位和精度规则；
- 小于 1 时保留前导零后的 4 位有效小数；
- 前导零数量大于 4 时使用下标压缩形式。

示例：

```text
0.41308123    → 0.4131
0.00001234567 → 0.00001235
0.0000041     → 0.0₅41
```

### 8.3 Unicode 下标序列化

`formatDisplayNumber()` 对极小数返回结构化片段：

```ts
['0.0', { type: 'sub', value: 5 }, '41']
```

Portfolio 在进入 JSON 前将下标数字序列化为真实 Unicode：

```text
0 → ₀
1 → ₁
2 → ₂
3 → ₃
4 → ₄
5 → ₅
6 → ₆
7 → ₇
8 → ₈
9 → ₉
```

多位下标逐位转换，例如：

```text
12 → ₁₂
```

不得把 `{ type: "sub", value: 5 }` 直接转换为普通字符串 `"5"`，否则 `0.0000041` 会被错误转换成 `0.0541`。

## 9. 法币符号兼容

Portfolio 仅发送 Firmware 字体资源能够显示的字符。

当前 App 按以下 Firmware 字体区间判断法币符号：

```text
U+0020–U+007E
U+00A0–U+024F
U+1E00–U+1EFF
U+2000–U+206F
U+2080–U+2089
```

如果法币符号为空，或任意字符不在支持范围内，则使用大写 ISO Currency Code，并在 Code 后增加一个 ASCII 空格：

```text
€ → EUR
₹ → INR
未知新符号 → 对应 currency id 的大写形式
```

最终示例：

```text
EUR 1.00
< EUR 0.01
```

ISO Code 本身也必须位于 Firmware 支持范围内，否则停止构建，避免生成设备无法显示的 Portfolio。

Firmware 字体资源需要包含 `U+2080–U+2089`，才能正确显示 App 发送的下标数字。

## 10. UTF-8 字节限制

以下单个金额字段必须是非空字符串，且不得超过 47 UTF-8 字节：

- `totalFiat`
- `tokens[].balance`
- `tokens[].fiatValue`
- `otherTokens.fiat`

校验发生在以下步骤全部完成之后：

1. App 数字格式化；
2. Unicode 下标序列化；
3. ASCII `<` 规范化；
4. 法币符号或 ISO Code 选择；
5. 最终字符串拼接。

App 使用 UTF-8 字节长度，不使用 JavaScript UTF-16 `string.length`：

```ts
Buffer.byteLength(value, 'utf8')
```

示例：

```text
0.0000041 → 9 UTF-8 字节
0.0₅41    → 8 UTF-8 字节
```

其中 `₅` 占 3 个 UTF-8 字节。

`totalFiat` 的完整格式超过限制时，App 改用科学计数法；其他字段超过限制时终止本次 Portfolio 构建。禁止直接截断字节，因为截断可能破坏 UTF-8 字符或改变金额语义。

## 11. 法币换算

Token 的原始法币金额会转换为 App 当前展示法币：

```text
目标金额 = 原始金额 / 原始法币汇率 × 目标法币汇率
```

以下情况视为不可用：

- 金额为 `null`、`undefined` 或空字符串；
- 金额不是有限数字；
- 原始汇率或目标汇率不存在、为零或不是有限数字。

不可用的 Token 法币金额按零参与 Portfolio 展示和占比计算。

## 12. 占比计算

Firmware 不解析展示金额。App 使用格式化前的数值计算：

- `tokens[].portfolioPercentage`
- `otherTokens.portfolioPercentage`

规则：

1. 所有非负有效金额参与计算；
2. 总额小于等于零时，所有占比为零；
3. 占比保留两位小数；
4. 最大金额项吸收舍入误差；
5. 非零 Portfolio 的全部 Token 与 Other 占比总和为 100。

这使 Firmware 可以安全显示 `< $0.01`、`0.0₅41` 等非数值展示字符串，同时继续准确绘制资产分布。

## 13. Token 元数据

### 13.1 原生资产与合约地址

- 全网络聚合资产：`contractAddress = ""`；
- 大多数网络原生资产：`contractAddress = ""`；
- Aptos、Sui 原生资产可保留规范化后的地址；
- 普通合约资产保留规范化后的合约地址；
- 大小写敏感网络保持原始地址大小写，其他网络使用小写。

### 13.2 标准名称与图标

App 使用同一份可信白名单解析 Token 的 `iconName` 和标准英文名称：

| `iconName` | 标准 `name` |
| --- | --- |
| `BTC` | `Bitcoin` |
| `ETH` | `Ethereum` |
| `BNB` | `BNB` |
| `SOL` | `Solana` |
| `TRON` | `TRON` |
| `USDT` | `Tether USD` |
| `USDC` | `USD Coin` |

名称处理规则：

1. 命中 Native、Contract 或 All Networks 图标白名单时，App 使用上表中的标准 `name`；
2. 未命中白名单时，App 保留上游 `token.name`，并保持 `iconName = null`；
3. App 不会仅根据普通合约 Token 的 `symbol` 分配标准名称或图标；
4. `TRX` 和 `TRON` 聚合 Symbol 都规范化为 `name = "TRON"` 和 `iconName = "TRON"`。

本地 Mock Portfolio 保留解析出的 `iconName`。正式提交服务端时，App 将 `iconName` 清空，但保留标准化后的 `name`：

```ts
{
  ...token,
  iconName: null,
}
```

最终签名包中的 `iconName` 和 `color` 必须由服务端可信规则产生。Firmware 只消费服务端最终结果。

### 13.3 服务端白名单 Key

服务端使用以下格式构建精确匹配 Key：

```ts
const key = `${networkId}:${contractAddress}:${name}`;
```

App 在生成 Portfolio 时已经完成合约地址规范化：EVM 地址统一为小写，Solana 和 TRON 地址保持大小写。服务端不需要根据 `isNative`、`isAllNetworks` 或 `symbol` 重新推导名称。

#### Native Token

| Network | `networkId` | `contractAddress` | `symbol` | `name` | `iconName` | 服务端 Key |
| --- | --- | --- | --- | --- | --- | --- |
| Bitcoin | `btc--0` | `""` | `BTC` | `Bitcoin` | `BTC` | `btc--0::Bitcoin` |
| Ethereum | `evm--1` | `""` | `ETH` | `Ethereum` | `ETH` | `evm--1::Ethereum` |
| BNB Smart Chain | `evm--56` | `""` | `BNB` | `BNB` | `BNB` | `evm--56::BNB` |
| Solana | `sol--101` | `""` | `SOL` | `Solana` | `SOL` | `sol--101::Solana` |
| TRON | `tron--0x2b6653dc` | `""` | `TRX` | `TRON` | `TRON` | `tron--0x2b6653dc::TRON` |

#### Contract Token

| Network | `networkId` | `contractAddress` | `symbol` | `name` | `iconName` | 服务端 Key |
| --- | --- | --- | --- | --- | --- | --- |
| Ethereum | `evm--1` | `0xdac17f958d2ee523a2206206994597c13d831ec7` | `USDT` | `Tether USD` | `USDT` | `evm--1:0xdac17f958d2ee523a2206206994597c13d831ec7:Tether USD` |
| Ethereum | `evm--1` | `0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48` | `USDC` | `USD Coin` | `USDC` | `evm--1:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48:USD Coin` |
| BNB Smart Chain | `evm--56` | `0x55d398326f99059ff775485246999027b3197955` | `USDT` | `Tether USD` | `USDT` | `evm--56:0x55d398326f99059ff775485246999027b3197955:Tether USD` |
| BNB Smart Chain | `evm--56` | `0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d` | `USDC` | `USD Coin` | `USDC` | `evm--56:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d:USD Coin` |
| Polygon | `evm--137` | `0x3c499c542cef5e3811e1192ce70d8cc03d5c3359` | `USDC` | `USD Coin` | `USDC` | `evm--137:0x3c499c542cef5e3811e1192ce70d8cc03d5c3359:USD Coin` |
| Polygon | `evm--137` | `0xc2132d05d31c914a87c6611c10748aeb04b58e8f` | `USDT` | `Tether USD` | `USDT` | `evm--137:0xc2132d05d31c914a87c6611c10748aeb04b58e8f:Tether USD` |
| Solana | `sol--101` | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` | `USDC` | `USD Coin` | `USDC` | `sol--101:EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v:USD Coin` |
| Solana | `sol--101` | `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB` | `USDT` | `Tether USD` | `USDT` | `sol--101:Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB:Tether USD` |
| TRON | `tron--0x2b6653dc` | `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t` | `USDT` | `Tether USD` | `USDT` | `tron--0x2b6653dc:TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t:Tether USD` |

#### All Networks 聚合 Token

| `symbol` | `name` | `iconName` | `networkId` | `contractAddress` | 服务端 Key |
| --- | --- | --- | --- | --- | --- |
| `BTC` | `Bitcoin` | `BTC` | `""` | `""` | `::Bitcoin` |
| `ETH` | `Ethereum` | `ETH` | `""` | `""` | `::Ethereum` |
| `BNB` | `BNB` | `BNB` | `""` | `""` | `::BNB` |
| `SOL` | `Solana` | `SOL` | `""` | `""` | `::Solana` |
| `TRX` / `TRON` | `TRON` | `TRON` | `""` | `""` | `::TRON` |
| `USDT` | `Tether USD` | `USDT` | `""` | `""` | `::Tether USD` |
| `USDC` | `USD Coin` | `USDC` | `""` | `""` | `::USD Coin` |

### 13.4 聚合资产

全网络聚合资产使用：

```json
{
  "isAllNetworks": true,
  "isNative": false,
  "contractAddress": "",
  "networkId": ""
}
```

当前 Firmware 允许 `isAllNetworks = true` 时 `networkId` 为空。

## 14. App 提交服务端

请求地址：

```text
POST /wallet/v1/hardware/portfolio/pack
```

请求体是 Portfolio JSON 对象，不是 PFOL/OKPKG 二进制包。

App 约定服务端负责：

- 严格校验 JSON 字段；
- 保持金额和余额展示字符串原样；
- 校验每个展示金额的 UTF-8 字节长度；
- 使用 `networkId:contractAddress:name` 精确匹配可信白名单；
- 根据命中的白名单配置补齐 `iconName` 和 `color`；
- 生成 Firmware 接受的资源包；
- 使用生产密钥体系签名；
- 返回 Base64 编码的完整包。

响应结构：

```json
{
  "data": {
    "packageBase64": "..."
  }
}
```

如果缺少 `packageBase64`、Base64 无法解码或服务端请求失败，App 不会开始硬件上传。

## 15. 内容哈希与去重

App 使用稳定 JSON 序列化和 SHA-256 计算内容哈希。

哈希排除 `ts`：

```ts
const { ts, ...content } = portfolio;
```

因此仅时间变化、其他内容完全相同的 Portfolio 不会重复上传。

去重状态在以下时机才提交：

- 服务端提交完成；或
- 硬件设备完成 `PortfolioUpdate`。

设备忙碌、断开或上传失败不会永久写入成功哈希，相同内容可以在条件恢复后重试。

## 16. Hardware SDK 上传

App 将服务端返回的 Base64 解码为独立 `ArrayBuffer`，然后调用：

```ts
uploadPortfolio(connectId, {
  operationId,
  packageBytes,
  timeoutMs,
});
```

SDK 执行两阶段流程：

1. 使用 `FilesystemFileWrite` 将包顺序写入：

   ```text
   vol1:/portfolio/portfolio.okpkg.pending
   ```

2. 最后一个分块确认后发送：

   ```text
   PortfolioUpdate {}
   ```

只有 `PortfolioUpdate` 返回 `Success`，SDK 才返回：

```json
{
  "portfolioUpdated": true
}
```

文件写入完成只表示候选包已经暂存，不代表 Portfolio 已应用。

## 17. 状态与失败处理

| 状态 | 含义 |
| --- | --- |
| `disabled` | Portfolio 调试功能未开启 |
| `empty` | 当前没有需要同步的正余额资产 |
| `duplicate` | 内容哈希与已完成或正在处理的内容相同 |
| `cooldown` | 目标设备仍在 20 秒冷却期 |
| `device-disconnected` | 目标设备已断开 |
| `hardware-busy` | Hardware Channel 正在执行其他操作 |
| `cancelled` | 被用户发起的高优先级硬件操作取消 |
| `built` | 非硬件目标已完成构建和服务端提交 |
| `uploaded` | 设备已成功执行 `PortfolioUpdate` |
| `error` | 构建、服务端或硬件步骤失败 |

硬件忙碌和取消场景会保留最新事件，并在冷却后重新尝试。

## 18. 安全与隐私

Portfolio JSON 包含：

- 账户名称或账户 ID 回退值；
- 账户编号或缩短地址；
- 主要资产的余额和法币价值；
- Token Symbol、名称、网络和合约地址；
- Portfolio 生成时间。

这些数据属于用户资产摘要，应按敏感财务数据处理。

Portfolio 包经过签名但不加密。不要在日志中输出完整 Portfolio、账户持仓或完整地址。

生产环境必须由服务端持有生产签名密钥。App 不持有生产私钥。

## 19. 验证清单

### 19.1 App

- [ ] `0.0000041` 输出 `0.0₅41`；
- [ ] 多位前导零数量逐位转换为 Unicode 下标；
- [ ] 小额法币使用 ASCII `<`；
- [ ] 不发送全角 `＜`；
- [ ] `totalFiat` 优先使用本地化完整金额和两位小数；
- [ ] `totalFiat` 仅在 16dp/350dp 放不下或超过 47 bytes 时使用 4 位有效数字科学计数法；
- [ ] Firmware 范围外的法币符号降级为 ISO Code；
- [ ] 四类金额字段都在最终拼接后校验 47 UTF-8 字节；
- [ ] 非 `totalFiat` 字段超过限制时停止构建，不截断字符串；
- [ ] Token 顺序与 UI 顺序一致；
- [ ] 白名单 Token 使用标准 `name`；
- [ ] 未命中白名单的 Token 保留原始 `name` 且 `iconName = null`；
- [ ] 占比总和正确；
- [ ] 内容哈希排除 `ts`。

### 19.2 服务端

- [ ] 保持 App 金额展示字符串原样；
- [ ] 拒绝超过 47 UTF-8 字节的金额字段；
- [ ] 使用 `networkId:contractAddress:name` 精确匹配白名单；
- [ ] 补齐合法的 `iconName` 和 `color`；
- [ ] 返回可被目标 Firmware 验证的签名包。

### 19.3 Firmware

- [ ] Parser 将金额视为受长度限制的 UTF-8 字符串；
- [ ] 字体资源包含 `U+2080–U+2089`；
- [ ] 首页与详情页正确显示 Unicode 下标；
- [ ] 环图仅使用 `portfolioPercentage`；
- [ ] Token 保持 App 传入顺序；
- [ ] `PortfolioUpdate` 成功后再刷新 UI。

## 20. 关键代码位置

| 范围 | 文件 |
| --- | --- |
| Portfolio 类型、格式化、占比和字节校验 | `packages/shared/src/utils/portfolioPayload.ts` |
| Token 标准名称与图标白名单 | `packages/shared/src/utils/portfolioTokenIcon.ts` |
| Portfolio 单元测试 | `packages/shared/src/utils/portfolioPayload.test.ts` |
| 稳定序列化和服务端提交数据构建 | `packages/kit-bg/src/services/ServiceHardware/serviceHardwarePortfolioSync/serviceHardwarePortfolioSyncUtils.ts` |
| 同步状态、去重、冷却和服务端请求 | `packages/kit-bg/src/services/ServiceHardware/serviceHardwarePortfolioSync/ServiceHardwarePortfolioSync.ts` |
| Hardware Service 适配 | `packages/kit-bg/src/services/ServiceHardware/ServiceHardware.ts` |
| SDK 上传实现 | `node_modules/@onekeyfe/hd-core/src/api/UploadPortfolio.ts` |
| Firmware 展示字符串协议 | `firmware-pro2/utils/onekey_protocol_cli/portfolio.protocol.md` |
| Firmware JSON Parser | `firmware-pro2/tasks/task_foreground/pages/standalone/portfolio_data.c` |
| Firmware Portfolio UI | `firmware-pro2/ui/components/portfolio/portfolio.c` |
