# 隐私链集成蓝图(需求定稿,2026-08-27 评审会结论)

本文是「隐私链模板」评审(grill)的全部结论,基于 zcash 落地经验 + 对
Monero/Firo/Beam/Penumbra/Ledger Live/Zashi/Cake/YWallet 的实证调研。
它是后续链(已确定:**Monero、Starknet Privacy**)的需求基线;VaultBase
契约稳定并经第二条链验证后,内容毕业进 `adding-chains.md`,本文降为
zcash 侧注记。

## 1. 范围:三条链、三种同步模型

| 链 | 同步模型 | 起点概念 | 组成 |
|---|---|---|---|
| Zcash(已落地) | 客户端扫 compact block(lightwalletd) | birthday | 透明 + 多池(Sapling 只读/Orchard/Ironwood) |
| Monero(下一条) | 客户端扫块(无轻协议;或 LWS 交 view key,**开工首决**) | restore height | 纯隐私单池 + subaddress;10 块共识硬锁 |
| Starknet Privacy | Discovery Service 拉取加密 note(不扫链);证明在 operator 侧 | 注册时刻(近似退化) | 隐私池按 token 分列 |

契约对同步方式保持不可知:`syncLocalWalletGroup` 只承诺「有界地推进一轮、
报告是否还有回填」,扫块和拉取都装得下。

## 2. 设计信条(评审定案,凌驾于实现偏好)

1. **能自动解决的自动解决**;必须打扰用户时,话要说到位(Ledger 式:
   讲清"什么人需要动它"+"不动的后果")。
2. **用户设置的一切必须可改、可见**。设置错了要有找回的路。
3. **调度控制权全部在 app 侧**:runtime/SDK 永不自主发起网络或扫描,
   一切同步动作由 ServicePrivacyChain 发起。接第三方 SDK(如 starknet
   privacy SDK)时,先包裹掉它的自主轮询。
4. 等待永远不是模态的:灰按钮 + 内嵌横幅 + CTA,绝不弹窗阻塞(§6)。

## 3. 分层与契约(单一可选 capability,2026-08-30 修订)

ServicePrivacyChain(调度器,链无关)↔ `ILocalWalletCapability` ↔ 各链 vault。
`VaultBaseChainOnly` 只保留一个可选入口:`getLocalWalletCapability()`;
普通链返回 `undefined`,不会继承一排空方法。开关仍是
`vaultSettings.localWalletSyncEnabled`。

| 方法 | 职责 |
|---|---|
| `listAccounts()` | 一次本地读:参与账户 + 物理 runtime 分组键 + GC 宽集 |
| `getChainTip()` | 轻量链头探测(独立 client;不改同步载体 endpoint) |
| `syncGroup({accountIds, chainTip})` | 一组一轮:修复日志回放 → 注册/准备 → 有界同步;返回 backfillRemaining |
| `reset({accountId, scope:'cache'\|'all'})` | 拆除:仅可重建缓存 / 全部本地痕迹 |
| `resetCarrier()` | watchdog 拆卸卡死载体 |
| `rescan({accountId, from, dryRun})` | 重扫,三种起点表达 + 预览(见 §4) |
| `onWalletAdded()/gcWalletState()` | 各链自行管理 wallet 级本地元数据生命周期 |
| `retryLocalWalletSetup({password})` | 密码门控补派生 |
| `getAccountMeta/getBalance/getSyncProgress` | UI 三视图;返回 discriminated DTO/通用进度 DTO,不用 `unknown` 跨层 cast |

`retryLocalWalletSetup` 是唯一留在 account-bound `VaultBase` 的独立方法:
它需要 keyring/password,不能挂在 chain-only 调度 capability 上。方法不再
散落成 VaultBase 的通用虚方法,但 capability 内仍刻意保持调用节奏分离:
chainTip 并入列表读会把网络调用焊进本地读节奏;三视图合一会让 8s 进度
轮询拖着 wasm 租约取余额;carrier 并入 reset 会混淆生命周期。

## 4. 扫描起点(scan start)规范

通用层术语统一为 **scan start**;"birthday" 只留在 zcash 实现内。

- **每账户一个起点;共享库的有效起点 = min(各账户起点)**。
- **创建流程永不被打断**。账户创建时隐私模式为关闭；用户主动开启时
  才设置扫描起点。新生成助记词推荐钱包创建月份，导入助记词必须选择
  首次使用月份，也可以显式选择从 Orchard 激活高度开始扫描。
- 之后 Repair 给的月份/高度 → **无条件生效**(复用现有扫描的捷径只允许
  "按已存起点重建"模式)。floor 全链扫只能来自用户显式勾选,永不默认。
- **通用机制(链级"创建后跟进")**:任何链在账户创建后需要用户补充的
  信息,统一延后到"用户首次关注该链"的页面上下文问一次,不打断创建。
  zcash 的扫描起点是首个实例;第二条链需要时抽成注册表(与 UI 描述符
  同一条"第二消费者才抽象"规矩)。钱包级 recovery-timestamp 通道保留为
  休眠管线,供未来非交互恢复流(如云备份)直接供值。
- 可见性(事故教训:「不知道谁把起点拖到 0」):Repair 弹窗常驻显示
  本账户当前起点;零余额+已同步+非新建 → 提示"导入前收过?去调起点";
  【待做】共享扫描被别的账户拖深时,点名归因并可跳转。

## 5. 扫描运行策略

- 同一时刻只有一条链在重扫(单飞轮转);用户正看的链插队提速
  (前台 TTL),其余降频;discovery 型同步算轻量,不占扫描台。
- 启动避让(60s)、看门狗(5min)+ 载体拆卸、网络失败换端点、
  确定性同型失败断路器、下载对半切——卡死六类台账见 `04-pitfalls.md`。
- 移动端:**开**(行业常态:Zashi/Cake/Monerujo 全部手机本地扫)。
  姿态=前台扫+进度可视化;iOS 不做后台(全行业空白);Android 定时
  后台扫为后置增强。耗电以真机目测验收。

## 6. 发送语义(三态,证据:Ledger Live 已发布代码)

| 状态 | 行为 |
|---|---|
| 从未同步 | 表单级错误,继续按钮灰(不弹窗) |
| 同步过(哪怕过时) | **放行**;金额按「上次扫描时点的成熟、未被在飞交易占用的可花集」校验 |
| 过时 | 灰字提醒"余额可能略旧"+ Sync CTA,**不拦截** |

spendable 口径 = 成熟(确认策略)+ 未被 reservation 占用;闸门与
选币同口径(总额亮按钮=事故);max 发送用报价收敛;错误从 runtime 出
结构化 code,host 换人话文案 + autoToast。

## 7. UI 组成描述符(五原则)

1. 默认合并成一桶「隐私余额」;分池是可展开明细(行业:Zashi 连池名都
   不显示;分池是 YWallet 式高级视图)。
2. 每池/每行可声明独立动作(Shield/Withdraw/迁移),能力位从第一天保留
  (YWallet Pool Transfer 先例);今天只有 zcash 用到。
3. 「不可花」一律是带原因+进度的状态枚举(确认中/锁定/需 shield),
   永不做并排的第二个余额数字(Monero 双数字教训)。
4. 组成由链的描述符声明:zcash=池;XMR=锁定态;starknet=按 token。
5. **同步状态横幅四态**(嵌进 send 流程,不只详情页):未同步(警告+CTA)/
   失败(错误+CTA)/进行中(进度+ETA)/过时(提醒不拦截)。
   【待做】zcash 确认页接入;组件本体等 XMR UI 动工时抽取。

## 8. 未来演进(已定向,未排期)

- **透明侧接服务器**(zcash 专属机会):t 余额/历史走标准链管线
  (后端 zcash Blockbook),隐私侧不变;移动端可先按"普通链+隐私提示"
  姿态上。**拼接四条接缝(实施约束,2026-08-27 定):**
  1. 闸门口径:Shield 可用判断必须继续用本地 runtime 的 spendable,
     不得改读 Blockbook 总额——谁选币,谁供闸门数(总额亮按钮=已犯过
     的事故)。
  2. 历史去重:按 txid 去重;语义本地优先(shielding/方向/净额),
     确认状态服务器优先(索引比扫描快,用它升级本地行的 pending);
     纯透明外部收付由 Blockbook 独家补齐。
  3. 花费账本:展示走 Blockbook,但 pcztShield 选币仍需本地 t-UTXO——
     改为点 Shield 时按需刷新(现成 lightwalletd 通路),同步循环里的
     每轮 UTXO 刷新即可摘除。
  4. 过渡窗口双计:withdraw 广播后 Blockbook 先 +X、本地隐私侧后减;
     自发交易理论不双计(pcztSend 已本地记花),但必须实测一条写进
     验收,防总额短暂虚高。
- 后端需求单:Zaino(lightwalletd)、网络注册、ZEC 价格、链图标、
  浏览器模板、(新增)zcash Blockbook。
- XMR 开工首决:本地全量扫 vs LWS 交 view key。
- 亲缘记录:工程栈最近亲是 Penumbra(compact block+插件 WASM 扫链);
  Beam 与被动扫链模型不兼容,排除。

## 9. 词汇表

| 术语 | 含义 |
|---|---|
| 隐私链 privacy chain | 余额需客户端持 viewing 级密钥本地发现的链 |
| 本地钱包 local wallet | 该发现过程的本地状态(可重建缓存,非资金) |
| 扫描起点 scan start | 本地钱包开始发现的高度/时刻(zcash: birthday;XMR: restore height) |
| 载体 carrier | 跑 wasm/SDK 的宿主(desktop Worker/ext offscreen/mobile web-embed/web 同线程) |
| 共享库 shared runtime | runtimeKey 必须等于物理数据库边界;Zcash 为 network,所有 seed 共扫一库(有效起点=min,生日继承仍限同 seed) |
| 组成描述符 composition descriptor | 链声明的 UI 行结构与每行动作/状态 |

## 10. 遗留台账(评审后未清)

- ~~UA 收款组成 A/B~~ **已定(2026-08-27)**:orchard-only,固件对齐;
  硬件账户显示地址问设备要(Ledger 模式)。详见 `05` D17 硬件对齐附记。
  待办降级为:固件改版后重贴 parity 向量。
- 拖深归因 UI;send 流程内横幅;outdated 分档。
- 生日选择器粒度:月(现状,偏早最多多扫 ~20 分钟但不会漏钱)vs 天
  (Ledger 式,快但赌用户记忆)——产品定,工程一行可切。
- 层间 P2 小项 ×4、P3 批(见 `05-decisions-and-open-questions.md`)。
- B 版契约试运行评估(XMR 接入时)。
