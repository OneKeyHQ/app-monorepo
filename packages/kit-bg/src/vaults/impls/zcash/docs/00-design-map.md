# Zcash 集成设计总图(对表用)

> ⚠️ **迁移说明（2026-08-23）**：本仓库已从 WebZjs fork 迁到
> `onekey-zcash-runtime`（官方 `librustzcash` + `zcash_client_sqlite` 之上的薄
> wasm 绑定层）。下列在本文件中反复出现的前提**已不再成立**，但原文保留 ——
> 记录当初为什么那样想，比一份没有历史的干净文档有用：
>
> - **COI / SharedArrayBuffer / 线程池**：新 runtime 单线程，不需要
>   `crossOriginIsolated`。Pixel 4 真机在 `crossOriginIsolated=false` 下完整跑通
>   扫链。因此 `syncWallet` 不再返回 `synced: false`，「移动端不能同步」这个前提消失。
> - **wasm 钱包状态序列化（`db_to_bytes` / blob 存 IndexedDB）**：新 runtime 用
>   SQLite 经 VFS 持续落盘，没有「快照」这个概念，相关的 revision 追踪、单飞保存、
>   purge 守卫全部不存在。
> - **每账户一份 runtime / 一份库**：见 D14，现为每 network 一库。
>
> 逐条替代决策见 `05-decisions-and-open-questions.md` 的 D14–D17。网络身份、
> 透明/隐私数据归属与广播恢复的当前约束见 `adr/0001-*`、`adr/0002-*`。

一页看全所有机制。每节 = 一个机制:干什么 / 谁触发 / 状态存哪 / 代码在哪。
决策依据在 `05-decisions-and-open-questions.md`(D1~D12),这里只画"现在是什么样"。
坑的病理在 `04-pitfalls.md`。**改任何机制前先改这页,对不上就是漂移。**

---

## 0. 分层与数据流(谁调谁)

```
┌─ UI (packages/kit) ──────────────────────────────────────────────┐
│ TokenDetails 池标签页 / 历史列表 / 发送页 / UTXO 详情页            │
└──────────────┬───────────────────────────────────────────────────┘
               │ backgroundApiProxy
┌─ 服务层 (kit-bg/services) ───────────────────────────────────────┐
│ ServicePrivacyChain: 同步节拍/GC/重扫闸门/一次性清除(通用,非zcash专属)│
│ ServiceHistory / ServiceSend: 标准管线(zcash 靠 Vault 覆写接入)     │
└──────────────┬───────────────────────────────────────────────────┘
               │ vaultFactory
┌─ Vault 层 (kit-bg/vaults/impls/zcash) ───────────────────────────┐
│ Vault.ts: ZEC0透明数据 + runtime隐私数据合成、发送、状态对账         │
│ KeyringHd.ts: 派生(存meta)/签名  settings.ts: 链能力声明           │
└──────────────┬───────────────────────────────────────────────────┘
               │ IZcashSdkApi(JSON-safe,跨桥)
┌─ 载体层 (跑在哪个"web"运行时) ────────────────────────────────────┐
│ 桌面/网页: zcashWebSdk   插件: offscreen + zcashWebSdk             │
│ 移动: web-embed + zcashWebSdk；keys包负责派生与PCZT签名             │
└──────────────┬───────────────────────────────────────────────────┘
               │ wasm-bindgen
┌─ WASM (onekey-zcash-runtime) ────────────────────────────────────┐
│ onekey-zcash-keys: 派生/PCZT签名(种子只在这里出现)                 │
│ runtime: 扫描/余额/历史/PCZT建证 + 官方zcash_client_sqlite         │
└──────────────┬───────────────────────────────────────────────────┘
               │ gRPC-web
        lightwalletd (zcash-mainnet.chainsafe.dev)
```

规矩(D12):**逻辑收敛在 TS,wasm 只留"别无去处"的原语**。
判定:要的数据/状态是否只存在于钱包库或协议内部且没有出口?是→加最小原语;否→不碰 wasm。
已知违规待迁移:历史/详情的计算公式还在 wasm(#33 迁移后冻结)。

---

## 1. 账户与密钥模型(D1/D3)

```
助记词(种子) ──只进 onekey-zcash-keys──▶ USK(花费钥,签名瞬间存在,用完即焚)
     │                              │
     │                              └─▶ UFVK(观察钥) ─▶ UA / t地址
     │
     └─▶ 种子指纹 seedFp(公开级,做钱包身份)

持久化(SimpleDbEntityZcash, 按 app 账户ID 键控):
  { ufvk, unifiedAddress, transparentAddress, seedFingerprintHex,
    hdIndex, birthdayHeight, addressSchemeVersion, createdAt }
```

- 一切跨边界签名走 **PCZT**(D3),硬件签名将来插同一接缝。
- 派生只在建账户时跑一次(KeyringHd);失败可用 retryLocalWalletSetup 补。

## 1.5 种子生命周期与泄露防线(安全模型)

```
静息态: 助记词密文 ── app标准加密库(密码派生密钥) ── zcash侧【零】持久化
                                │ 密码解锁(仅两个动作: 建户派生 / 签名)
瞬时态: seedHex ──跨桥──▶ keys runtime ──hexToBytes──▶ Uint8Array
                                │                        │用完 fill(0) ✓
                                ▼                        ▼
                        webzjs-keys wasm: USK派生 ── 种子副本用完 zeroize ✓(alpha.21)
                                │                    USK 用完 free ✓
                                ▼
输出面(能出wasm的全部): UFVK / 地址 / 签好的PCZT / 种子指纹(单向哈希,不可逆)
```

五道防线:
1. 单一入口(D1): 种子只在 deriveAccount / signPczt 两个函数短暂现身,
   同步/余额/历史整条线只见 UFVK;react-native-zcash 因索要种子被否。
2. 密码门: 两条路径都过 KeyringHd 密码解锁,无密码拿不到明文。
3. 即用即焚: JS 侧 Uint8Array fill(0);wasm 侧种子副本 zeroize(alpha.21 起);
   USK/seedFp 即用即 free(签名路径 best-effort,RC 会消费参数)。
4. 存储面观察级: meta = UFVK 级(泄露 = 隐私损失,非资金损失,等价泄 xpub)。
5. 日志纪律: 任何日志只出 hdIndex/长度,永不出 seedHex(CLAUDE.md 铁律)。

诚实的残余风险(按可利用性):
- 同运行时代码=满权限: 桌面 main/bg 同堆,被攻破的依赖或 XSS 可直接挂钩
  keyring 调用点或读 wasm 内存 —— wasm 不是安全边界,运行时才是。
  防御=供应链纪律(min-release-age)+CSP;终极解=硬件签名(D3 的 PCZT
  接缝就是为它留的,种子彻底离开软件)。
- JS 字符串不可清零: seedHex 以 string 过桥(ext/RN 桥只走 JSON),
  GC 前滞留堆中,堆快照可见。缓解方向: 支持结构化克隆的边界改传字节。
- USK 内部落锤不清零: 上游 zcash_keys 无此特性(zeroize 仅挂在
  transparent-key-encoding 下),属上游局限,可提 PR。
- 解锁瞬间的内存窗口: 所有链共有,非 zcash 特有。

## 2. 共享扫描域(每网络一个 SQLite wallet)

```
databaseName = zcash-${network}.db
database {
  accounts          // UFVK 去重；可来自不同助记词
  birthdays         // runtime缓存；App meta是恢复权威源
  scan state        // 一次下载/扫描服务该网络全部账户
  local txs         // pcztSend先落库，broadcast后置
}

注册: create_account_ufvk(ufvk, seedFp, hdIndex, birthday)
      wasm 侧按 UFVK 去重 → 重复注册返回现有ID(幽灵账户物理不可能)
      生日钳位: ≤419200(Sapling激活) → 419201(树状态请求必须打在存在的高度)
```

- **全网络合并**：一次扫描对数据库里的全部 UFVK 做 trial decryption。注册更老生日的
  新账户会重新排队其缺失区间，因此恢复旧账户前必须给用户明确成本提示。
- 删除单个账户只移除该账户派生缓存；最后一个账户删除后才删除数据库文件。

## 3. 同步调度(双车道 + 有界步进)

```
车道A TIP: Desktop 每30秒、可挂起端每3分钟【每网络只查一次链尖】
            TIP没变 → 不进钱包wasm、不序列化blob、不刷新余额
车道B Birthday: 只要 Historic 仍有活,按 runtime 轮转继续回填
                  Desktop冷却5秒;插件/移动冷却30秒;不再1秒热循环
账户成员变化: 新账户/重复账户加入时进入一次有界轮次;
              同hdIndex要求更老生日 → 整个共享runtime重建(树锚必须变老)

单次 syncWallet(有界步进, wasm ≥ alpha.19):
  ┌────────────────────────────────────────────────┐
  │ sync_step(最多4批×1000块, 元数据按3分钟节流)       │
  │   wasm内: 更新链尖 → 按优先级取队列               │
  │           ChainTip先扫 → Historic吃剩余预算       │
  │ 返回后立即放写锁; 一轮只做一步                    │
  │ 有历史余量 → backfillRemaining=true, 冷却后续跑   │
  │ 扫描标记/元数据无变化 → stateChanged=false        │
  │   不db_to_bytes、不发RefreshTokenList             │
  └────────────────────────────────────────────────┘

公平性: 每次全局只让一个 wallet runtime 做一步;TIP候选优先;
        多个 birthday runtime 用 lastBackfillRuntimeStateKey 轮转。
```

超时纪律(04 有病理):**每一个触网的 wasm 调用必须 withTimeout**
(注册/派生/链尖/步进/单体回退/广播)。这里"不返回"不是慢,是永久静默冻结。

## 4. 本地状态边界

```
SimpleDB:
  UFVK、透明/统一地址、birthday、隐私模式意图和少量操作日志

runtime SQLite（每 network 一份）:
  扫描状态、note/UTXO、隐私交易事实和广播生命周期
```

当前仍在开发期，不保留旧 blob、旧交易历史或旧池能力的兼容迁移。改变
runtime schema 或扫描池集合后清空本地隐私数据并从 birthday 重扫。

## 5. Birthday 体系(扫描起点从哪来)

```
建账户时:
  仅初始化隐私模式为关闭，不加载 runtime，不派生隐私元数据
  开启时: 新生成助记词推荐创建月份；导入助记词必须选择首次使用月份
  扫描起点不早于 Orchard 激活高度

运行期三条修正通道:
  ① 手动: TokenDetails → Edit Birthday → rescanFromHeight(purge+写新生日)
          走回填闸门(上限1), 弹强警告(清本地余额+重扫耗时)
  ② 自动收养: 某账户还蹲地板生日 且 兄弟账本里有"付给它"的已上链记录
          → 起点自动挪到 最早那笔高度-1000 → 重建
          (模块级5分钟节流; 跨助记词也生效; wasm≥18 才有详情接口)
  ③ 池升级 requeue: 见第4节第二行版本号(不动生日,只补扫尾段)
  ④ 用户自助重置(正式产品能力): TokenDetails → "Local cache — Reset"
     清两样【可重建缓存】: wasm扫描库 + 本地历史行(meta/生日/资金全不动)
     → 从已存生日重扫。同步出任何怪状态, 用户自己一键脱困;
     之所以敢给端用户, 是 D4 的直接推论: 它删的一切都是缓存。
     (行业同款: Zashi/YWallet 的 rescan/clear 控件)
```

## 6. 历史与详情(数据从哪来,怎么合并)

```
真相源: wasm 账本(收到票据表/花费联表/透明输出表/对外输出表/交易元表)
        txid 进出一律【展示序】(字节反转, 与浏览器/pczt.txid()一致)

wasm 提取(暂驻wasm, #33迁TS):
  每笔净额 = 本账户收到(含找零) − 本账户花掉的输入
  分类: 有对外输出→发送 | 有花有收→内部转移(充池/取回) | 否则→接收
  费: 交易表有则用, 否则 花−收−对外(>0才算)   池标签: 含 ironwood 真值

Vault 映射: 3类型/3状态(过期→失败), pending无块时间→用当前时间(防沉底)
展示合并: wasm现算行 ∪ 本地存量(发送时存pending; 确认后存confirmed)
  pending翻转: 托盘轮询 → fetchAccountHistoryDetail(本地覆写)
               找到已上链→Success / 过期→Failed / 没找到→保持pending
  化石防线: 版本号清除(第4节第三行)
详情页: Inputs=我方被消耗票据(池标签/透明带地址)
        Outputs=对外(真实收款地址,仅自己发的可知)+我方新票据(找零标注)
        复用 BTC 的 UTXO 页, 零新UI
已知边界: 平铺200条窗口(#34真分页) / 自转显示-V(#33) / 进度比率不含ironwood
```

## 7. 发送三通道(全部走 PCZT 接缝)

```
标准发送: 精确报价quote → createPczt → prove(Halo2,含Ironwood) 
          → KeyringHd签名(sign_ironwood) → send → 存pending
充池Shield(D10): 一键无审阅页 → pczt_shield → prove → 签 → send
取回Withdraw:   费率梯子[10k..50k]只重试【建案】, 广播只跑一次(无双发结构)
UA校验: bech32m语法级(u1..., F4Jumble长度) app侧; 语义在wasm
收款路由(上游规则): orchard收据(激活后→Ironwood池) > sapling > 纯透明才透明
```

## 8. 生命周期与删除(D5)

```
AccountRemove事件 + 开机兜底 → GC: 孤儿账户 purge
purge 爆炸半径 = 整个助记词的共享缓存(兄弟按各自生日重建, 有意为之)
meta 只删被移除账户的; 缓存可重建(D4)兜底一切删除语义
```

---

## 遗留台账(编号对任务)

- #21/#33 分池历史+公式迁TS(D12收敛) ・ #34 真分页 ・ #35 i18n
- #25 游魂null-pointer(purge协调修后待观察) ・ #26 证明挪worker+体积
- #27 ZIP318迁池(上游0.24正式版) ・ 硬件UFVK级去重(硬件接入时)
- 转账确认后数秒UI冻结 = 证明在主线程(#26), 与本批无关
