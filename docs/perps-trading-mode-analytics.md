# Perps 简易版 / 专业版埋点

基于 PR #14042。本次新增的是交易界面维度 `tradingUiMode: simple | pro`，与现有 `perp | spot` 市场类型、`cross | isolated` 保证金模式分开。

## 本次实现

| 事件 | 触发时机 | 新增属性 / 关键属性 | 分析用途 |
| --- | --- | --- | --- |
| `orderOpen` | 普通市价 / 限价开仓接口返回成功或抛出错误 | `tradingUiMode`，保留 `status`、`duration`、`errorCode`、`isFirstTime` | 按界面模式比较下单量、失败率、耗时、首次成功下单 |
| `ordersClose` | 市价 / 限价平仓接口成功或失败 | `tradingUiMode` | 区分平仓来源 |
| `setPositionTpsl`、`cancelOrder`、`modifyOrder` | 设置止盈止损、撤销订单（含止盈止损）、追价修改订单成功或失败 | `tradingUiMode` | 比较订单管理操作及失败率 |
| `updateLeverage`、`updateIsolatedMargin` | 调整杠杆 / 保证金模式、调整逐仓保证金成功或失败 | `tradingUiMode` | 区分仓位设置操作来源 |
| `withdraw` | 提现接口成功或失败 | `tradingUiMode` | 按模式分析提现结果 |
| `perpDepositInitiate` | 现有直充 / Relay 跨链充值结果回调 | `tradingUiMode`，保留 `depositRoute`、`status` 等 | 按模式与充值路径分析结果 |
| `perpDepositMethodPanelView`、`perpDepositMethodSelect`、`perpDepositAddressSourceSelect` | 充值方式面板展示、方式选择、地址充值来源选择 | `tradingUiMode` | 分析充值入口与方式选择 |
| `perpTokenSelectorOpen`、`perpTokenSelectorPrimaryTabClick`、`perpTokenSelectorCategoryTabClick`、`perpTokenSelectorSortClick`、`perpTokenSelectorTokenClick`、`perpTokenSelectorSearch` | 现有选币面板交互 | `tradingUiMode` | 按模式分析找币行为 |
| `perpTermsAgree`、`perpTermsReject` | 现有交易条款确认 / 拒绝操作 | `tradingUiMode` | 按模式分析启用交易流程 |
| `perpTradingModeSelectorOpen` | 打开模式选择弹窗 | `tradingUiMode` | 统计模式入口使用量 |
| `perpTradingModeSwitch` | 确认切换到另一种模式，或操作入口引导进入专业版 | `fromMode`、`toMode`、`source` | 分析切换方向，以及切换是否由功能需求驱动 |

`source` 的取值：

- `modeSelector`：模式选择弹窗确认。
- `orderSettings`：简易版下单设置中的“更多订单类型”。
- `twapOrders`：简易版 TWAP 订单入口。
- `spotEntry`：历史现货交易跳转到专业版。

打开弹窗、选择选项、确认切换不是同一个行为。这里只在打开时记录一次，在确认改变模式时再记录切换；仅点选选项、关闭弹窗、确认当前模式均不计作切换。设置初始化也不计作用户切换。

## 数据口径

- 交易及资金操作复用现有事件，仅增加模式属性；不新增下单按钮、确认弹窗或输入操作埋点。

- 交易模式从发起界面经 action / 确认弹窗传到后台，充值提现从入口传入表单及后续回调，不在请求完成时重新读取偏好。宽屏 Web 的专业版不会因保存了 `simple` 偏好而被误记。Native 与窄屏 Web 按当前移动端模式归类。
- 简易版直下单和确认弹窗下单均携带 `simple`；现有专业版普通开仓路径使用 `pro`。元数据只进入日志，不加入 Hyperliquid 的 SDK 订单或签名字段。
- `orderOpen.status=success` 沿用现有接口日志定义，不能解释为订单已全部成交。成交率需要结合成交记录另行统计。
- 各接口事件仍沿用原触发范围，不覆盖进入 SDK 请求前的全部校验失败。TWAP、Scale 为专业版独立下单路径，本次未修改其日志。经简易版入口跳转到专业版操作时，先记录模式切换，后续操作归属专业版。
- 地址充值仅扩展现有面板 / 方式 / 来源选择事件，没有新增链上到账事件。`perpUserSelectDepositToken` 当前没有调用方，本次仅兼容其属性类型，没有新增触发。
- 移动端选币器在页面挂载时统一上报一次打开事件，覆盖首页、行情详情、下单页及历史记录跳转，原入口不再重复上报。分类、排序和选币复用桌面端已有事件；自动校正分类不计作用户点击。
- 充值记录页再次进入地址充值时保留原模式与入口；独立充值记录入口使用 `entrySource=depositHistory`，补齐后续来源选择日志。
- 页面访问、账户状态、后台连接 / agent 诊断事件不在本次操作埋点范围。
- 现有钱包地址脱敏逻辑保持有效。新增字段均为枚举和行为信息。
