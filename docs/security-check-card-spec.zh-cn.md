# 安全检查卡片产品与验收规范

> 状态：本地草案（Draft）
>
> 版本：0.1
>
> 更新日期：2026-08-21
>
> 适用范围：dApp 发起的交易确认与消息签名确认；钱包内部流程复用卡片时遵循相同判定规则

## 1. 文档目的

本规范为产品、客户端、服务端和 QA 提供同一套安全检查卡片规则，回答以下问题：

- 卡片检查并展示哪些信息
- 每类信息属于高风险、警告、未知还是普通提示
- 多个来源结论冲突时，总结论如何计算
- Prime 针对性检测与网站安全检测、解析提示如何组合
- 什么情况下隐藏、展示、展开、要求二次确认或阻断操作
- 每个状态应如何验收

本文使用以下约束词：

- **MUST**：产品和实现必须满足，否则属于缺陷
- **SHOULD**：默认应满足，偏离时必须说明原因
- **MAY**：可选增强，不影响核心判定

## 2. 一句话总规则

**风险严重度、检查进度、用户确认门槛是三条独立的轴，不得互相替代。**

- `severity` 回答“发现了什么、严重到什么程度”
- `progress` 回答“必要检查是否仍在进行”
- `confirmation` 回答“用户在继续前需要完成什么动作”

因此：

- “需要核对授权信息”不等于“发现风险”
- “Prime 针对性检测”是检查来源和能力，不是风险等级
- “网站已认证”不等于“本次交易或签名安全”
- “未检测到问题”只表示已执行的适用检查未发现已知问题，不代表绝对安全

核心决策摘要：

| 情况               | 展示                                      | 是否阻断                                                        |
| ------------------ | ----------------------------------------- | --------------------------------------------------------------- |
| 检查中             | Loading；已有结论时保留结论并追加 spinner | 临时阻断，检查结束后解除                                        |
| Critical / Warning | 展示具体风险证据                          | 要求 risk checkbox，勾选后可继续                                |
| Unknown            | 中性展示，不得绿色                        | 默认不阻断；只有 raw/local parse fallback 需要 request checkbox |
| Info               | 展示客观条款，不称为风险                  | 默认不阻断；`isConfirmationRequired` 时需要 request checkbox    |
| Success            | “未检测到问题”并展示真实覆盖范围          | 不阻断；可与 Info + request 同时存在                            |
| Prime 针对性检测   | 作为当前请求的检查来源                    | 由其返回等级决定，不单独改变门槛                                |

## 3. 信息模型

### 3.1 输入来源

| 来源              | 回答的问题                                         | 典型输入                                             | 是否直接决定严重度  |
| ----------------- | -------------------------------------------------- | ---------------------------------------------------- | ------------------- |
| 网站安全检测      | 当前域名是否已知恶意、可疑或无法验证               | `origin`、网站安全等级、攻击类型                     | 是                  |
| Prime 针对性检测  | 这一次具体交易或 JSON-RPC 签名请求是否包含已知风险 | `encodedTx` 或 `method + params`、风险特征           | 是                  |
| 交易/签名解析     | 用户实际将执行什么、解析器发现了哪些异常           | parser alerts、typed data、Permit、order、custom hex | 是；纯事实只算 Info |
| 地址风险标签      | 收款方、授权对象、合约等地址是否有风险标签         | address tags                                         | 是                  |
| 交易模拟/资产变化 | 执行后可能发生哪些资产变化                         | simulation assets                                    | 否；属于事实预览    |
| 二次确认标记      | 该请求是否要求用户人工核对关键条款                 | `isConfirmationRequired`                             | 否；只决定确认门槛  |

### 3.2 标准 Finding

每条 Finding 至少应具有以下语义字段；具体 API 字段名可不同：

| 字段           | 含义                                                    |
| -------------- | ------------------------------------------------------- |
| `source`       | `site`、`requestScan`、`parser`、`address`              |
| `scopeKey`     | 该结论绑定的 origin、请求修订或地址；内容变化后必须失效 |
| `category`     | `site` 或 `operation`                                   |
| `severity`     | `critical`、`warning`、`unknown`、`info`                |
| `code`         | 稳定、可测试、可埋点的机器码                            |
| `title`        | 一句话事实或结论                                        |
| `content`      | 必要的原因、影响或核对说明                              |
| `confirmation` | `none`、`request` 或 `risk`                             |
| `suppressible` | 是否属于可被更具体结论取代的泛化提示                    |

严重度与确认门槛 MUST 分字段表达。例如“无限授权”可以是 `info + request`，不能为了显示 checkbox 被伪装成 `warning`。

### 3.3 检查覆盖

“没有 Finding”不能证明“完成了检查”。客户端还必须独立记录每个来源的覆盖状态：

```ts
type SecurityCheckCoverage = {
  source: 'site' | 'requestScan' | 'parser' | 'address' | 'simulation';
  scopeKey: string;
  state: 'notApplicable' | 'pending' | 'completed' | 'failed';
};
```

- `notApplicable` 不生成 Unknown，也不阻断
- `pending` 进入临时阻断
- `completed` 才能贡献 Success 覆盖
- `failed` 生成 Unknown，但是否二次确认仍按第 5.2 节决定
- Batch 必须逐项记录覆盖，不能通过过滤 `undefined` 推断“全量完成”

## 4. 严重度与总体状态

### 4.1 Finding 严重度

| 严重度     | 用户含义                         | 归类标准                                   | 典型例子                                                                  | 默认展开                     | 默认确认门槛        |
| ---------- | -------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------- | ---------------------------- | ------------------- |
| `critical` | 已发现高可信、高影响风险         | 已知恶意或可直接造成重大资产风险           | 恶意网站、恶意地址、Prime `high`、危险裸签名方法                          | 是                           | `risk`              |
| `warning`  | 发现可信的可疑行为，需要谨慎复核 | 有具体异常证据，但未达到高危确定性         | 可疑网站、Prime `medium`、parser 具体告警、危险 custom data               | 是                           | `risk`              |
| `unknown`  | 本次检查未能给出结论             | 必要检查失败、超时、无法解析或来源无法验证 | Prime `unknown`、`unable_to_assess`、raw/local parse fallback、未验证网站 | 操作未知为是；仅网站未知为否 | 见 5.2              |
| `info`     | 与决策相关的客观事实，不代表风险 | 请求类型、授权范围、对象、金额、期限       | Permit/typed data/order、无限授权条款、spender、deadline                  | 否                           | `none` 或 `request` |

归类约束：

1. 只有具体风险证据才能归入 `critical` 或 `warning`。
2. “Permit/签名可能有风险”这类只基于请求类型的泛化句 MUST NOT 单独成为 `warning`；应归为 `info`，或在有更具体结论时被抑制。
3. 检查失败 MUST 是 `unknown`，不得伪装成 `success`、`info` 或静默消失。
4. 功能明确不适用、用户无对应权益、网络不支持等“未执行”状态不是检查失败，不生成 `unknown`；但覆盖范围 MUST 如实展示。

将无限授权等高权限事实归为 `info + request` 是明确的产品决定：它提高用户核对强度，但不在没有风险证据时制造黄色警告。

### 4.2 总体状态

卡片总体状态是当前请求的单一摘要，不等于任意一条 Finding：

| 总体状态   | 计算规则                                                          | 建议标签     | 颜色/图标                      |
| ---------- | ----------------------------------------------------------------- | ------------ | ------------------------------ |
| `critical` | 存在任一 `critical` Finding                                       | 风险         | 红色 / `ErrorSolid`            |
| `warning`  | 无 `critical`，存在任一 `warning` Finding                         | 需确认       | 黄色 / `InfoSquareOutline`     |
| `unknown`  | 无更高风险，存在任一 `unknown` Finding                            | 未验证       | 中性灰 / `QuestionmarkOutline` |
| `success`  | 所有适用且必要的检查均完成，且无 `critical`、`warning`、`unknown` | 未检测到问题 | 绿色 / `CheckRadioOutline`     |
| `info`     | 无足够覆盖形成 `success`，但存在需要展示的事实信息                | 提示         | 信息色 / `InfoCircleOutline`   |
| `loading`  | 必要异步检查进行中，且还没有其他可展示结论                        | 检查中       | 中性小转圈                     |

总体状态 MUST 按以下优先级计算：

```text
critical > warning > unknown > success > info > no-status
```

补充规则：

- `info` Finding 不得把一个已成立的 `success` 降级为“警告”；成功摘要与信息条款可以同时存在。
- 检查进行中时若已存在风险 Finding，摘要继续展示当前最高风险，并额外显示中性小转圈；不得用 Loading 覆盖已知风险。
- `success` 的覆盖范围 MUST 通过副标题展示，例如“网站安全 · 签名分析 · 针对性检测”。
- 非 Prime 或不支持针对性检测时，只能展示实际完成的基础覆盖，不能暗示已完成 Prime 针对性检测。

### 4.3 来源到严重度、门槛的标准映射

| 来源结果/事实                                       | severity                | confirmation        | 说明                                                  |
| --------------------------------------------------- | ----------------------- | ------------------- | ----------------------------------------------------- |
| 网站已知恶意/`high`                                 | `critical`              | `risk`              | 站点风险只作用于当前 origin，但不得被请求安全结果覆盖 |
| 网站可疑/`medium`                                   | `warning`               | `risk`              | 有具体站点风险证据                                    |
| 网站未验证/`unknown`                                | `unknown`               | `none`              | 未收录或无结论，不等于恶意                            |
| 网站已验证/`security`                               | 无负面 Finding          | `none`              | 只贡献网站检查覆盖                                    |
| Prime 请求 `high`                                   | `critical`              | `risk`              | 当前 payload 的高风险结论                             |
| Prime 请求 `medium`                                 | `warning`               | `risk`              | 当前 payload 的可疑结论                               |
| Prime 请求 `unknown` 或检查失败                     | `unknown`               | `none`              | 两者文案和埋点必须区分；均不得显示绿色                |
| Prime 请求 `security`                               | 无负面 Finding          | 由其他信号决定      | 贡献当前 payload 的针对性覆盖                         |
| 被策略明确判定为危险的签名方法                      | `critical`              | `risk`              | 例如被标记为 risky 的裸签名请求                       |
| Parser 返回具体异常证据                             | `warning` 或 `critical` | `risk`              | 严重度必须来自稳定 code/结构化等级，不能只靠文案      |
| Permit、Order、typed data、无限授权等条款事实       | `info`                  | `none` 或 `request` | 高影响不等于恶意；是否核对由 confirmation 标记决定    |
| raw message、local parse fallback、无法解释 payload | `unknown`               | `request`           | 用户必须知悉钱包无法完整解释请求                      |
| 地址 warning/critical 标签                          | 对应 `warning/critical` | `risk`              | 风险标签保留在地址旁，同时必须进入总体状态            |
| 正常模拟资产变化                                    | 不生成 Finding          | `none`              | 仅作为事实预览，不代表风险也不代表安全                |

UI 仍只需要“网站”和“本次请求”两个详情分组；地址标签留在地址旁，simulation 留在资产预览中，但它们对总体状态的贡献必须遵守上表。

## 5. 用户确认与阻断规则

### 5.1 四种确认状态

| `confirmation` | 含义                             | Checkbox                 | 确认按钮                     | 是否阻断         |
| -------------- | -------------------------------- | ------------------------ | ---------------------------- | ---------------- |
| `none`         | 无额外安全门槛                   | 不显示                   | 正常主按钮                   | 否               |
| `pending`      | 必要异步检查尚未完成             | 不显示                   | 禁用                         | **临时硬阻断**   |
| `request`      | 用户必须核对信息或知悉检查未完成 | 显示与场景匹配的核对文案 | 勾选前禁用；勾选后正常主按钮 | **可解除软阻断** |
| `risk`         | 已检测到具体风险，用户仍选择继续 | 显示风险知悉文案         | 勾选前禁用；勾选后危险按钮   | **可解除软阻断** |

当前产品不设置不可绕过的永久安全阻断。若未来存在合规或策略性禁止，应新增独立 `blocked` 状态，不能复用 `critical`。

### 5.2 Unknown 的确认规则

`unknown` 是否要求二次确认取决于“未知的对象”，而不是只看颜色：

| Unknown 来源                                           | confirmation | 原因                                                             |
| ------------------------------------------------------ | ------------ | ---------------------------------------------------------------- |
| Prime 针对性检测返回 `unknown`                         | `none`       | 明确展示“未验证”，但不把无结论误判为风险                         |
| Prime 针对性检测失败、超时或 `unable_to_assess`        | `none`       | 明确展示“无法完成检查”并区分埋点；供应商故障不应自动制造用户阻断 |
| 交易/签名无法解析、只能展示 raw data 或 local fallback | `request`    | 用户需要明确知悉钱包无法完整解释请求                             |
| 仅网站无法验证，但请求仍可正常解析                     | `none`       | 中性展示，不把“未收录”误判为风险                                 |
| 功能不适用、网络不支持、非 Prime 未执行针对性检测      | `none`       | 这是覆盖范围差异，不是失败                                       |

这是有意采用的 fail-open 规则：Unknown MUST 可见且不得显示绿色，但 Prime 服务可用性本身不成为额外 checkbox。只有用户需要人工补足理解的 raw/local parse fallback 才进入 `request`。

### 5.3 信息二次确认

信息二次确认属于 `info + request`，不是 `warning` 或 `risk`。

适用示例：

- Permit 或 Permit2 的授权对象、代币、额度、有效期需要人工核对
- 无限授权或超长有效期需要用户明确知悉
- 订单签名、代理执行等高影响但不一定恶意的请求

规则：

- 卡片内展示“需要核对什么”和具体条款
- Footer checkbox 使用具体核对文案，例如“我已核对授权对象、代币、额度和有效期”
- 勾选后使用正常主按钮，不使用风险红色按钮
- 如果同一请求同时存在 `warning/critical`，确认状态升级为 `risk`，只保留一个风险 checkbox
- 兼容可信 Permit 流程：标准 Permit/Permit2 来自安全等级为 `security` 的网站，且没有具体风险 Finding 或地址风险时，`isConfirmationRequired` 不单独触发 checkbox；Permit 条款仍展示为 `info`

## 6. Prime 针对性检测

### 6.1 定位

Prime 是权益和检查能力；针对性检测是信号来源。它们都不是严重度。

- 卡片标题不展示 Prime Badge
- Blockaid 不对用户露出
- SignGuard/技术支持仅在存在可见交易模拟，或针对性检测实际进入 Pending/返回结果时展示；仅有网站检测、解析信息或地址标签时隐藏
- 归属文案不得表达担保，例如不得使用“Prime 安全”“100% 安全”

### 6.2 适用条件

针对性检测在以下条件全部满足时才是“适用检查”：

1. 请求来自 dApp，存在有效 `origin`
2. 用户 Prime 权益有效
3. 网络和请求方法受服务端支持，且不是自定义网络
4. 能构造完整的 `encodedTx` 或 `method + params`

不满足条件时是 `not-applicable`，不是 `unknown`。

### 6.3 结果映射

| 服务端结果               | Finding/总体语义                   | confirmation   |
| ------------------------ | ---------------------------------- | -------------- |
| `high` / 旧 `Malicious`  | `critical`                         | `risk`         |
| `medium` / 旧 `Warning`  | `warning`                          | `risk`         |
| `security` / 旧 `Benign` | 提供针对性安全覆盖；无风险 Finding | 由其他信号决定 |
| `unknown`                | `unknown`，文案为“未验证”          | 由其他信号决定 |
| 超时、异常、空结果       | `unknown`，文案为“无法完成检查”    | 由其他信号决定 |

顶层 `level` MUST 不低于 `features[]` 中的最高风险等级。客户端 SHOULD 防御性取顶层与 feature 的最高风险，避免出现“摘要安全但详情高危”。

## 7. 多来源聚合与冲突规则

### 7.1 聚合顺序

1. 收集网站、针对性检测、parser 和地址 Finding
2. 先按稳定 `code + address + 关键参数` 去重
3. 仅按第 7.2 节规则抑制泛化提示
4. 计算最高风险总体状态
5. 独立计算确认状态
6. 最后决定是否展示、展开和按钮状态

确认状态优先级：

```text
pending > risk > request > none
```

展示排序：

1. `critical`
2. `warning`
3. `unknown`
4. `info`
5. 同等级下，具体请求/具体地址证据优先于泛化提示
6. 相同语义保持服务端原顺序

Prime 来源不得越过更高严重度 Finding 排到最前。

### 7.2 泛化提示去重

只基于请求类型的泛化提示不得单独成为风险结论。例如“Permit 签名可能导致资产损失”应与同一请求的结构化 Permit 核对项合并，只保留一条中性的 `info`。这属于信息去重，不依赖网站认证或 Prime 检测结果。

只有包含具体对象、行为或威胁证据的 parser alert 才能保留为独立 `warning/critical`。

以下信息永远不能被安全结果抑制：

- 网站 `medium/high/unknown` 事实
- 地址风险标签
- Prime 或 parser 返回的具体风险证据
- 授权对象、代币、额度、有效期、recipient、value 等交易事实
- 无限授权、资产转出等需要用户核对的事实
- raw data、custom hex、parse fallback 等覆盖不足事实

特别说明：网站已认证只能说明网站来源，Prime `security` 只能说明本次针对性检测未命中已知威胁；两者都不能抑制授权事实或具体风险证据。

### 7.3 典型冲突结果

| 输入组合                               | 总体状态                   | confirmation   | 展示规则                                    |
| -------------------------------------- | -------------------------- | -------------- | ------------------------------------------- |
| 网站 `high` + Prime `security`         | `critical`                 | `risk`         | 网站风险保留，Prime 安全不得覆盖            |
| 网站 `security` + Prime `high`         | `critical`                 | `risk`         | 展示本次请求风险                            |
| Prime `security` + 可信站点泛化 Permit 提示 | `success` 或由其他信号决定 | `none`         | 隐藏泛化警告，保留 Permit 条款 Info         |
| Prime `security` + 无限授权            | `success`                  | `request`      | 展示无限授权事实和核对 checkbox，不称为风险 |
| Prime `security` + parser 具体 warning | `warning`                  | `risk`         | 保留具体 warning                            |
| Prime `unknown` + 网站 `security`      | `unknown`                  | `none`         | 明确本次请求无结论，但不自动增加风险门槛    |
| 网站 `unknown` + 请求解析正常且无风险  | `unknown`                  | `none`         | 中性展示网站未验证，不使用红色按钮          |
| Prime 不适用 + 基础检查完成且无问题    | `success`                  | 由信息项决定   | 覆盖副标题只列基础检查，不出现针对性检测    |
| Prime 不适用 + 泛化 Permit 提示        | 由其他有效信号决定         | 由具体条款决定 | 合并为 Permit 条款 Info，不制造泛化 warning |
| Info 二次确认 + Warning                | `warning`                  | `risk`         | 只显示一个风险 checkbox，信息条款仍保留     |

## 8. 卡片展示规则

### 8.1 是否展示

满足任一条件时展示卡片：

- 有 `critical/warning/unknown/info` Finding
- 有必要检查处于 `loading`
- 已形成可解释的 `success` 总结论
- 有需要合并展示的交易模拟资产变化

以上条件均不满足时隐藏卡片。

### 8.2 Header 与详情

- 标题固定为“安全检查”
- 副标题展示实际覆盖来源，不展示营销口号
- 右侧只显示一个总体状态
- 有 Finding 时使用可折叠结构；纯 Loading 或纯 Success 使用静态紧凑行
- `critical/warning` 默认展开
- 操作层 `unknown` 默认展开；仅网站 `unknown` 默认收起
- `info` 默认收起
- 状态在用户停留期间升级时 MUST 自动展开；用户手动收起后，状态未升级不得反复抢焦点

### 8.3 Finding 行

- 标题必须是事实或可执行结论，避免重复“请注意”“存在风险”
- 描述只补充原因、影响或核对方式；无新增信息时不展示描述
- 有 features 时，卡片保持紧凑，通过 Details 展示 feature 列表
- feature 按 `high > medium > unknown > security` 排序
- feature 图标和颜色使用自身等级，不继承父级颜色

### 8.4 Loading

- 使用中性小转圈
- 不使用 Prime Badge、绿色扫光、轮播或多重动画
- 已有 Finding 时保留 Finding 摘要，只在右侧追加小转圈
- 必须有超时；超时后转 `unknown`，不得无限 Loading

## 9. 批量交易与请求变化

- 批量交易总体状态取所有子请求的最高风险
- 任一子请求处于必要检查 Pending 时，整批确认保持 `pending`
- feature 按 `code + address` 去重，但不同 address、amount、spender 或 deadline 不得误合并
- 用户编辑交易、授权额度、接收方、网络或签名内容后，旧检测结果和旧 checkbox 授权 MUST 失效
- 异步旧请求返回时不得覆盖当前请求结果

## 10. 服务端与客户端契约

针对性检测标准响应：

```ts
type TransactionSecurityResult = {
  level: 'high' | 'medium' | 'security' | 'unknown';
  detail: {
    code: string;
    title?: string;
    content?: string;
    features: Array<{
      level: 'high' | 'medium' | 'security' | 'unknown';
      code: string;
      title?: string;
      content?: string;
      address?: string;
    }>;
  };
};
```

契约规则：

- 请求体 MUST 在 `encodedTx` 与 `jsonRpc: { method, params }` 中二选一
- `undefined/not-applicable` 与 `unknown/unable_to_assess` MUST 保持可区分
- `code` 是稳定测试和埋点标识；`title/content` 是展示文案
- `features` 为空不代表请求安全，最终以顶层 level 和适用覆盖为准
- 客户端不得自行维护会快速漂移的 JSON-RPC method 白名单；支持范围由服务端判定
- 服务端返回旧枚举时，客户端兼容映射：`Malicious -> high`、`Warning -> medium`、`Benign -> security`

## 11. QA 验收矩阵

### 11.1 P0 核心用例

| #     | 场景                                     | 预期总体状态          | 预期 confirmation | 关键 UI/交互                                         |
| ----- | ---------------------------------------- | --------------------- | ----------------- | ---------------------------------------------------- |
| P0-01 | 无 Finding、无覆盖、无模拟               | 无                    | `none`            | 卡片隐藏                                             |
| P0-02 | 针对性检测 Pending，暂无 Finding         | `loading`             | `pending`         | 中性转圈；Confirm 禁用；无 checkbox                  |
| P0-03 | Pending 期间已有 parser warning          | `warning` + spinner   | `pending`         | Warning 保留并展开；Confirm 禁用                     |
| P0-04 | Prime `high`                             | `critical`            | `risk`            | 红色风险；展开；勾选后危险按钮可用                   |
| P0-05 | Prime `medium`                           | `warning`             | `risk`            | 黄色需确认；勾选后可继续                             |
| P0-06 | Prime `security`，无其他问题             | `success`             | `none`            | 紧凑“未检测到问题”；正常确认                         |
| P0-07 | Prime `unknown` 与超时/异常两组场景      | `unknown`             | `none`            | 分别显示“未验证”/“无法完成检查”；不得绿色；正常确认  |
| P0-08 | 非 Prime/不支持，基础检查正常            | `success`             | 由信息项决定      | 覆盖副标题不包含针对性检测                           |
| P0-09 | 网站 `high` + Prime `security`           | `critical`            | `risk`            | 网站风险不得被覆盖                                   |
| P0-10 | 网站 `security` + Prime `high`           | `critical`            | `risk`            | 本次请求风险优先                                     |
| P0-11 | Prime `security` + 可信站点泛化 Permit 提示 | `success`             | `none`            | 泛化 warning 隐藏；Permit 事实保留；无 checkbox      |
| P0-12 | Prime `security` + 具体 parser warning   | `warning`             | `risk`            | 具体 warning 保留                                    |
| P0-13 | 全部适用检查完成且安全，仅有无限授权条款 | `success`             | `request`         | Success 摘要 + Info 条款 + 核对 checkbox；非红色按钮 |
| P0-14 | 地址 warning/critical，卡片无其他风险    | 对应 warning/critical | `risk`            | 总体结论必须反映地址风险                             |
| P0-15 | 仅网站 Unknown                           | `unknown`             | `none`            | 中性、默认收起、正常按钮                             |
| P0-16 | raw/local parse fallback                 | `unknown`             | `request`         | 默认展开；提示核对 raw data                          |
| P0-17 | 同时存在 Info confirmation 与 Warning    | `warning`             | `risk`            | 仅一个风险 checkbox                                  |
| P0-18 | 用户修改请求后旧请求返回                 | 当前请求状态          | 重新计算          | 旧结果丢弃；旧 checkbox 失效                         |

### 11.2 P1 细节用例

- Details 中 feature 严重度、图标、颜色和顺序正确
- 相同 `code + address` feature 去重；不同地址不去重
- 批量交易取最高风险，任一 Pending 时 Confirm 禁用
- 风险升级时自动展开；同等级刷新不反复展开
- 用户手动收起后状态未升级时保持收起
- success、unknown、warning、critical 的中英文文案不承诺绝对安全
- SignGuard 在可见交易模拟或针对性检测参与时展示，其他基础检查隐藏
- MessageConfirm 与 TxConfirm 的 checkbox、按钮状态和颜色一致
- 钱包内部签名若不展示风险 checkbox，不得因此绕过本应生效的安全策略；应有单独明确规则和测试

## 12. 当前实现对照（2026-08-21）

### 12.1 已符合

- 已将 Finding 严重度、总体状态和 confirmation 分为不同字段
- 总体风险优先级为 `critical > warning > unknown > info > success > loading`
- Pending 时 MessageConfirm 和 TxConfirm 均禁用确认
- Pending 期间已有 Finding 时保留 Finding，并追加中性 spinner
- Prime `high/medium/security/unknown` 已映射到统一等级
- Warning、Unknown、Success、Info 已使用克制且可区分的图标与颜色
- 请求 identity 变化时会忽略旧异步结果；Tx 在交易内容变化后会重置确认
- SignGuard 仅归属可见交易模拟和实际参与的针对性检测
- 泛化 Permit 告警已合并为一条结构化 Permit Info，具体 parser 风险仍保留
- 地址标签最高风险已进入总体状态，地址明细仍只在地址旁展示
- `request` 使用核对文案和正常按钮，只有 `risk` 使用风险文案和危险按钮
- Info Finding 可与已成立的 success 总结论同时展示

### 12.2 与目标规范存在差异

| #   | 当前差异                                                                       | 目标规则                                                     | 代码位置                                                            |
| --- | ------------------------------------------------------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------------- |
| G2  | raw/local parse fallback 仅产生 Unknown，不保证进入二次核对                    | 无法解释请求内容时应为 `unknown + request`                   | `securityCheckModel.ts`、解析结果契约                               |
| G6  | coverage 标题没有区分是否实际执行 Prime 针对性检测                             | 副标题必须准确列出实际覆盖                                   | `securityCheckModel.ts`                                             |
| G7  | Prime Finding 排序优先于严重度                                                 | 先按严重度，再按具体性和来源排序                             | `securityCheckModel.ts`                                             |
| G9  | 服务端判定为不适用前，部分边界场景仍可能短暂 Pending                           | 只有实际适用且已发起的检查进入 Pending                       | `MessageConfirm.tsx`、`TxConfirm.tsx`、`ServiceSignatureConfirm.ts` |
| G10 | 客户端信任顶层 level，没有防御性合并 feature 最高风险                          | 顶层与 feature 取最高风险                                    | `transactionSecurityUtils.ts`                                       |
| G11 | Batch 合并会过滤 `undefined` 子结果，部分覆盖时仍可能得到 request-scan success | 所有适用子请求全量覆盖后才能形成针对性 success               | `transactionSecurityUtils.ts`、`TxConfirm.tsx`                      |
| G12 | Message 的 checkbox 是组件本地 boolean，没有显式绑定 request identity          | 消息内容或请求 identity 变化后必须重置 acknowledgement       | `MessageConfirmActions.tsx`                                         |
| G13 | Security Check 的 Pending 只覆盖 Prime 检查，不覆盖网站检查与 Message parser   | 所有被定义为“必要”的异步检查都应进入统一 progress/gate       | `MessageConfirm.tsx`、`securityCheckModel.ts`                       |
| G14 | 服务端 `unknown` 与超时/异常都可能回退为同一 Unverified 展示                   | 区分“无结论”和“检查失败”的 code、文案与埋点                  | `ServiceSignatureConfirm.ts`、`securityCheckModel.ts`               |

以上剩余差异应按风险和依赖拆成后续实现任务。

### 12.3 当前自动化缺口

- Card accordion、状态 badge、Finding 行和 footer 集成没有完整自动化覆盖
- 非 Prime、自定义网络、encodedTx service 和 batch 页面链路缺少端到端状态测试
- P0 自动化可先使用可访问文本与现有 testID；实现规则变更时只补必要的最小测试钩子

## 13. 发布验收口径

安全检查卡片可发布必须同时满足：

1. P0 用例全部通过
2. 任意组合下，总体状态与最高有效风险一致
3. `pending` 不可绕过，且有明确超时终态
4. `unknown` 不显示为绿色或静默吞掉
5. `request` 与 `risk` 的文案、颜色和按钮语义不混用
6. Prime、SignGuard、网站认证均不作为安全担保
7. 请求发生变化后，检测结果和用户确认不会串到新请求
8. MessageConfirm 与 TxConfirm 对相同语义返回相同结果
