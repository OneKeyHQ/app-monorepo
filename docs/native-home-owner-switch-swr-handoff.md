# Native Home Owner Switch、SWR 与渐进更新 Handoff

日期：2026-07-27

状态：

- Native transport 已收敛为唯一的 protocol v3 per-domain Latest-Wins；
  V1/V2、增量 patch、ACK、反向 snapshot recovery 和兼容分支均已删除。
- Native transport 的成功回调、等待门闩、超时重试与 slot 展示门闩已从当前分支移除。
- owner 原子切换、Native surface 复用、完整 SWR、banner 渐进发布、局部 atom
  读取和 frame 级 transport 合并已在当前分支实现。
- 自动化协议、Store、scheduler 和渲染计数测试已通过；iOS 26.5 Debug
  模拟器已完成同 wallet 账户往返切换视觉验证。iOS/Android Release 真机的
  首帧耗时、完整场景矩阵和内存指标仍待执行，不能由 Jest 或 Debug 结果代替。
- 目标平台为 iOS 与 Android Native Home。

> 2026-07-27 transport 最终决策：本文后续历史段落中出现的 V1/V2、
> snapshot/patch、`needSnapshot`、slot revision gap 或兼容协议描述均已失效。
> 当前唯一有效的边界是 owner full snapshot + `shell`、`navigation`、
> `section:<tabId>`、`surface` 完整域值；同域按 controller generation
> Latest-Wins，不同域互不等待。

关联文档：`docs/home-runtime-effect-scheduler-handoff.md`

## 1. 现象与结论

现象：

1. 切换账户时整个 Native Home 闪烁并重新进入 loading。
2. banner 的网络数据和本地数据存在，但界面可能永久不展示。
3. 代码中存在 SWR 术语，但切换 owner 时没有体现缓存立即可见的优势。

复现素材：

```text
/Users/huhuanming/Desktop/Screen Recording 2026-07-27 at 10.19.22 AM.mov
```

排查确认 banner 并非简单的请求失败：

- wallet banner API 可以完成；
- SimpleDB 中存在本地 banner；
- 持久化 Home display snapshot 中存在 banner record；
- shell 仍可能停留在 `banner: none`。

根因集中在 surface 生命周期、owner hydration、SWR 覆盖范围、派生顺序和
发布边界，不是图片加载器本身。

## 2. Runtime 拓扑

### 2.1 iOS / Android

- `main` JS runtime 持有 React Native、Home Store、session、source
  orchestration、mobile bridge 和 Native Home container。
- `bg` JS runtime 持有通过 `backgroundApiProxy` 调用的服务。
- 两个 JS heap 不共享对象；跨 runtime 数据会分别序列化和反序列化。
- MMKV、DB、文件句柄和 native singleton 可能由进程级 native 资源共享。
- `main` 和 `bg` 独立初始化，不得假设固定 ready 顺序。
- Native Home host 由 main runtime 驱动；bg 不拥有该 view。

因此：

- bg 内存缓存可以减少服务延迟，但不能替代 main 中可直接渲染的 Home
  display cache；
- owner cache 必须加载到 main 的 Home Store；
- 旧 session 的结果即使无法物理取消，也不能进入新 session；
- transport 是进程内调用，但正确性不依赖连续序号。Native 接受同域 generation
  gap，忽略同域旧 generation 和旧 owner session；没有反向确认或 recovery 请求。

### 2.2 Desktop / Web

Desktop 和 web 是单 runtime。共享代码不能引入 Native 同步存储假设。
本方案中的 Native surface 与 Nitro transport 规则只应用于 iOS/Android；
Store、SWR 和 scheduler 规则必须保持跨平台。

## 3. 不可破坏的约束

1. 每次 owner transition 都创建全新的 `sessionId`。
2. 旧 `sessionId` 不得复用于新 owner，也不得复用于稍后再次访问的同一 owner。
3. 旧 session 启动的结果不得修改新 session。
4. 不得把旧 owner Store 原地改造成新 owner Store。
5. owner transition 必须原子安装：
   - target owner 的 prepared cache；或
   - target owner 自己的 initial loading state。
6. 新 owner label 下不得出现旧 owner 数据。
7. owner 替换使用完整 target-owner snapshot；同 owner 后续更新使用完整域值，
   不使用增量 patch。
8. Native surface 生命周期与 wallet/account/owner/session 解耦，不允许
   owner-derived React key remount surface。
9. owner bundle 必须同时包含 owner、session、Store commit、Native snapshot 和
   完整 slot bundle；Native body domain generation 与 React slot 版本独立。
10. cache identity 与 execution identity 分离：
    - cache 可跨 session 复用；
    - 请求去重、取消与发布权限必须包含 session。
11. `@onekeyhq/native-components` 只负责 renderer/protocol，不读取 Home
    business Store 或 service。
12. owner replacement 可以读取全部 owner-scoped slice；同 owner event 只能读取
    已声明依赖并写入语义变化的 slice。
13. unchanged atom、slot reference 和 native domain value 必须稳定。
14. semantic no-op 不产生 Store commit、React invalidation、snapshot write 或
    Native transport。
15. 不通过提高 scheduler、leaf、Store commit 或 Native transport 的既有限额
    来换取渐进加载。
16. 新 session 的 revalidation eligibility 独立；是否发物理请求由 freshness/TTL
    决定，不由“新 session”本身决定。
17. owner prepare 优先立即读取并发布现有 prepared cache。
18. 不增加 payload byte、row 或 item 数量限制；先用 Release 数据测量。

约束 2 和 4 已写为英文代码注释：

```text
packages/kit/src/views/Home/model/lifecycle/homeSessionMachine.ts
packages/kit/src/views/Home/model/store/homeStoreReducer.ts
```

## 4. 八个问题

### P-01：owner 切换等价于重启 Native container

`MobileNativeHomeRendererBridged.tsx` 按 `owner.scopeKey/sessionId` 重建
`MobileNativeHomeBridgeRuntime` 和 `HomeContainerController`，上层还存在
owner-derived React key。切换 wallet 时会 remount `NativeHomePageView`。

结果是 Native viewport、scroll/gesture 状态、bridge authority 和首屏 loading
一起重置。现有 `HomeContainerController.replaceOwner()` 已具备在不销毁 surface
的前提下替换完整 snapshot 的基础。

### P-02：owner reset 与 target cache hydration 非原子

当前顺序是先清空 owner-scoped slice 并提交 loading，再异步 hydrate target
cache。这保证了“不展示旧 owner”，但必然制造一帧全空状态。

正确顺序是先 prepare target owner bundle，再一次 commit 替换 owner 和所有
owner-scoped slice。prepare 失败时也只能安装 target owner 自己的 loading，
不能继续展示旧 owner 内容并换上新 label。

### P-03：Native persisted SWR 没有 hydrate banner

`homeSnapshotLoader.native.ts` 读取 critical snapshot 后返回 `records: []`。
preferred-tab lazy hydration 只覆盖 section source，banner 是 eager non-section
source，因此持久化 banner 没进入 main Store。

`loadPreparedHomeDisplaySnapshot.native.ts` 已能读取 critical、banner 和 portfolio
record，但未接入 owner transition。

### P-04：内存 SWR 排除了 eager non-section source

`HomeSourceRuntime.hydrateCache()` 和正常 cache write 路径偏向 section source。
portfolio/NFT/DeFi 等能使用 confirmed cache，banner/capability 却不能，导致同一
runtime 中 SWR 语义按 source 类型分裂。

### P-05：请求去重状态跨 session 泄漏

`lastLoadedKey` 只使用 `sourceId -> sourceKey`，没有 session。A -> B -> A 时，
旧 A 的 loaded key 可能抑制新 A session 的 revalidation。

logical task 有 session，但 leaf queue 主要按 client 计数；旧 session 的排队 RPC
可能继续占用容量。结果拒绝保证 correctness，却不能保证切换后的首屏延迟。

### P-06：banner visibility 通过 balance 派生并依赖事件顺序

banner resource ready 后，还要把可见性写进 `balance.bannerAvailable`。若 banner
或 portfolio 先于 facts 完成，`createBalanceEvent()` 可能返回 `undefined`；
之后 facts reconciliation 又可能被 P-05 去重，最终出现“resource ready，
shell 永久 hidden”。

projection 必须是 canonical resource state + facts 的纯派生结果，不能只靠某次
source completion side effect。

### P-07：`Promise.all` 把独立 banner 数据锁成一个发布屏障

当前 `loadBanner()` 同时等待：

- remote wallet banner；
- local SimpleDB banner；
- bot-wallet deactivation；
- Hyperliquid referral eligibility。

虽然请求并发执行，首个可见结果仍然是最慢依赖的完成时间。可选 referral 会
阻塞普通 banner；一个 banner workflow 还可能占满 Native 的四个 shared leaf
slot。

问题不是并发 Promise 本身，而是把所有依赖放在同一个首次 publication barrier。

### P-08：fresh/stale/failure 与渐进发布语义不完整

leaf error 被折叠成 `undefined`、`false` 或 `null`，造成：

- remote/local failure 看起来像权威 empty；
- local fallback 看起来像 live；
- bot status failure 变成 fail-open；
- Store 无法区分 stale、live、empty、failed。

`leading/intermediate/final` sink 中 intermediate 可能在 backpressure 下丢失。
首个 stale frame 不能只依赖 best-effort intermediate，必须来自 owner 原子
hydration。

## 5. 目标架构

### 5.1 Owner transition

```text
global account selection changes
  -> create a new sessionId
  -> cancel old-session queued logical and leaf work
  -> prepare target-owner cache without mutating committed Home
  -> build one target owner bundle
  -> atomically replace Home owner + scoped Store slices
  -> HomeContainerController.replaceOwner(full snapshot)
  -> same mounted Native surface renders target cache/loading
  -> admit bounded revalidation work
  -> same-owner source completions commit local Store slices
  -> controller publishes complete changed-domain values
```

Surface 不 remount，controller 不重建，Native viewport state 由现有 host 保留。
owner replace 清空旧 pending domain 并提交完整 snapshot；之后每个 domain 使用
独立 controller generation，不依赖全局 base revision。

### 5.2 Native transport

正常路径是单向、进程内、per-domain Latest-Wins：

```text
Store commits in main
  -> one scheduled flush per frame
  -> latest complete value per domain wins within the frame
  -> full snapshot for owner replacement
  -> complete domain values for same-owner changes
  -> Native validates owner and per-domain generation
```

规则：

1. JS 不等待 Native 成功回调，不维护 submitted-but-unconfirmed gate。
2. 不设置 transport timeout，不做基于 timeout 的重发。
3. 每域 generation 由 controller 独立单调递增，允许跳号。
4. 同一 frame 内的多次更新合并为一次 flush；默认使用
   `requestAnimationFrame`，无 RAF 环境退化为 microtask。
5. slot bundle 在提交时立即进入 wrapper presentation，不等待 render 完成。
6. 同 owner 时只比较目标 domain generation；不同 domain 不读取或等待彼此。
   owner 不同时只接受当前 `scopeKey + sessionId`。
7. Native 仍维护内部 rendered state，用于 intent authority 和可见 page 的
   revision 校验，但不向 JS 发送成功事件。
8. 同域旧 generation 与 stale-owner batch 静默忽略；generation gap 直接接受。
9. schema/业务 invariant 非法时报告 render error，不建立反向恢复协议。
10. React slots 与 Native body domain 独立；slot render 可合并或跳过中间帧。

这套模型不要求 Native 连续应用每个中间状态。因为每个 domain 携带完整值，
Native 可以直接从 generation N 跳到 N+K。

### 5.3 SWR state machine

每个 source 对 owner-scoped cache 使用明确状态：

```text
absent
  -> loading

confirmed cache
  -> stale-visible
  -> revalidating
  -> fresh-visible | stale-with-error

no cache
  -> loading
  -> fresh-visible | empty-visible | blocking-error
```

冲突消解：

- `fresh` 与 `stale` 不是两个可同时发布的 owner state，而是同一 resource 的
  provenance/freshness；
- cache publish 只允许在 live result 尚未以更高 source revision 提交时发生；
- live result 使用 source revision/CAS 覆盖 stale cache；
- 迟到 cache 不得覆盖 live；
- 旧 session 的 cache prepare 或 live result 都不得发布到当前 owner；
- revalidation failure 保留 stale data 并附带 error metadata；
- 无 cache 的失败才进入 blocking error；
- safety 状态未知不能折叠为“明确安全”。

### 5.4 Banner progressive workflow

保留一个 bounded banner workflow，不把每个 leaf 拆成 critical source：

1. owner prepare 立即发布 confirmed persisted/in-memory banner cache。
2. remote 与 local normal banner 可以并发，但任一产生可展示聚合结果时即可
   形成中间 publication。
3. bot safety/status 是独立 policy input；未知状态采用现有安全策略，不伪造成
   `false`。
4. referral 是 optional warm work，只有 capability 和可见场景允许时才进入
   shared leaf pool。
5. 每次 leaf settle 后重新纯函数聚合；语义相同则不 commit。
6. final bookkeeping 可以使用 `Promise.allSettled`，但 UI 首次 publication
   不等待全部 settle。
7. intermediate backpressure 不承担首个 stale frame；confirmed cache 已在
   owner atomic commit 中可见。

### 5.5 并发与通信节流

不提高既有限额：

- logical scheduler 继续按 session、priority 和 source fairness 调度；
- shared leaf pool 保持当前 running/pending 上限；
- optional referral 不占用 first-frame critical 配额；
- 同一 source execution key 只允许一个物理请求；
- session cancel 先移除 queued logical/leaf work，再允许新 session admission；
- 不可取消的 running work 保持计数直到 settle，但失去 publish/derive 权限；
- polling 在上一次周期请求仍运行时跳过，不叠加请求；
- Store 使用 transaction 合并同一 publication 的 slice changes；
- React component 订阅 selector/atom，不读取整个 Home Store；
- Native transport 同 frame 合并并对 semantic no-op 静默。

通信量不能靠 payload 体积阈值约束，而要靠可测量的事件数量约束。

## 6. 包职责

### `packages/kit`

- owner/session lifecycle；
- prepared cache reader 与 atomic owner commit；
- source cache、freshness、execution key、scheduler；
- deterministic projection；
- banner progressive aggregation；
- selector/atom 级依赖声明和 semantic no-op。

### `apps/mobile`

- 持有稳定 bridge runtime/controller；
- 将 owner bundle 转换为完整 snapshot 或同 owner 完整域值；
- 不直接从 global active account 混入已提交 owner UI；
- 保持 Store authority 与 transport domain generation 分离。

### `packages/native-components`

- renderer/protocol/slot bridge；
- owner/revision 校验；
- frame 级 latest-wins transport；
- 内部 rendered state 与 intent authority；
- 不引入 Home Store、service 或 business cache。

### `packages/kit-bg`

- 提供现有 service/RPC；
- 不承担 main 可渲染 Home cache 的所有权。

## 7. 实施阶段

### Phase A：稳定 surface 生命周期

1. 移除 `native-${sceneName}-${walletId}` 一类 owner-derived key。
2. 将 `MobileNativeHomeBridgeRuntime` 提升为 surface-lifetime 实例。
3. owner change 调用 `replaceOwner()`，不 dispose/recreate runtime。
4. 保持 refresh、intent、visible tab callback 的当前 owner/session authority。
5. 为跨 wallet、同 wallet account、network scope 三种切换增加 identity 测试。

### Phase B：原子 prepared-owner transition

1. 增加纯 prepare API，读取 target critical/banner/portfolio records。
2. prepare 阶段不得 mutate 当前 owner Store。
3. 构建完整 target bundle，并一次 reducer transaction 安装。
4. 没有 cache 时安装 target loading bundle。
5. commit 前 owner-sensitive adapter 继续读取 committed owner bundle，不直接读取
   已变化的 global account。
6. commit 后才启动 target revalidation。

### Phase C：完整 SWR

1. cache registry 覆盖 eager non-section source。
2. cache key 保持可跨 session，execution key 加入 `sessionId`。
3. `cancelSession()` 清除该 session 的 loaded/in-flight/queued execution state。
4. 引入 provenance、freshness、source revision 和 error metadata。
5. cache-first publish 与 live result 使用 source revision/CAS。
6. 保持 stale data on revalidation error。

### Phase D：确定性 projection

1. banner visibility 从 canonical banner、balance、facts 和 policy 纯函数派生。
2. facts、banner 或 balance 任一变化都运行相同 projection。
3. 删除只在 banner completion 时创建 balance side effect 的唯一依赖。
4. reducer 对语义相同的 projection 返回原引用。

### Phase E：banner 渐进发布

1. 移除首次 publish 的整体 `Promise.all` barrier。
2. 保持一个 workflow，并让 normal banner、safety 和 optional referral 分阶段
   settle/aggregate。
3. optional referral 使用 warm priority 和 capability gate。
4. final completion 只负责终态记录，不阻塞已可见内容。

### Phase F：局部更新证明

1. 为每类 Home event 声明 read set、write set 和 affected selectors。
2. owner replace 是唯一全量读取/写入路径。
3. same-owner event 只读声明依赖，不调用全局 `getState()` 组装完整 Home。
4. reducer 对 unchanged slice 保持引用；revision 只在对应语义变化时递增。
5. Native adapter 只序列化 revision vector 标记的 shell/navigation/section/slot。
6. 增加 render-count 与 transport-count 断言，而不是只检查最终 DOM。

## 8. 验收标准

### AC-01：container 与 bridge 复用

- 同 wallet account 切换、跨 wallet 切换和 network scope 切换时，
  `HomeContainer` host identity 不变。
- bridge runtime/controller identity 不变。
- Native scroll position、selected tab 和 gesture state 不因 owner change 被销毁；
  若产品要求回到 portfolio，应是显式 command，不是 remount 副作用。

### AC-02：session 与 owner 隔离

- 每次 transition 都产生新 `sessionId`，包括 A -> B -> A。
- 旧 session result、cache prepare、timer、poll 和 leaf completion 均无法发布。
- 旧 owner Store 不被原地改名或改 owner 字段。
- 任意 frame 不出现新 owner label + 旧 owner body/slot。

### AC-03：SWR 立即可见

- 有 confirmed cache 时，owner atomic commit 的首帧直接包含 target critical、
  banner 和 preferred-tab data。
- cache read 不等待 bg ready 或网络。
- 不增加 byte/row/item hard limit。
- cache 后台 revalidation 不把 stale UI清空为 loading。
- live completion 只更新实际变化的 resource。

### AC-04：fresh/stale 无冲突

- 迟到 cache 不能覆盖更高 revision live result。
- revalidation failure 显示 stale-with-error，不伪造成 empty/fresh。
- 无 cache failure 与 stale cache failure 可区分。
- safety unknown 不等价于 safe。
- freshness 变化但可见 model 不变时，不产生无意义 Native domain submission。

### AC-05：渐进 banner

- ordinary local/remote banner 不等待 optional referral。
- 任一可展示 normal banner 准备好后即可 publish。
- referral 慢或失败不隐藏普通 banner。
- facts/banner/balance 任意到达顺序得到相同最终 projection。
- 语义相同的中间聚合不重复 commit。

### AC-06：并发节制

- 不提高 scheduler 和 shared leaf pool 的既有限额。
- 一个 banner workflow 不占用多个 logical critical source 名额。
- optional leaf 不阻塞 first-frame portfolio/capability。
- A -> B -> A churn 后旧 session queued work 被移除；不可取消 running work 仍被
  计数但无 publish 权限。
- 同 execution key 不出现重复物理请求。

### AC-07：Native transport 无洪流

对同 owner、同 frame 20 次 progressive update：

- scheduled flush 数为 1；
- Native submission 数为 1；
- payload 是该 frame 最后语义状态。

对 20 次在 flush 前完成的 rapid owner transition：

- full snapshot submission 数为 1；
- 只包含最终 owner；
- 中间 owner slot/snapshot submission 数为 0。

对跨多个 frame 的有效同 owner 更新：

- 每 frame 至多一个 submission；
- 同域 generation 单调增加且允许跳号；
- 一个 domain 的旧 generation 不阻塞另一个 domain；
- 不存在周期性 retry 或 timeout resubmit；
- semantic no-op submission 数为 0。

协议异常：

- stale-owner batch 被忽略；
- 同域 stale batch 被忽略；
- generation gap 被直接接受；
- malformed payload 被拒绝且不触发 ACK、recovery request 或 retry。

### AC-08：局部 Store / React / Native 更新

portfolio data-only event：

- banner、NFT、DeFi、Perps、history atom reference 不变；
- 不读取未声明的全局 Home snapshot；
- 只有 portfolio selector subscriber rerender；
- Native domain batch 不包含无关 section/shell。

banner-only event：

- portfolio/NFT/DeFi/Perps/history atom reference 不变；
- 无关 body component render count 不增加；
- Native 只提交 shell/banner 相关变化。

global facts event：

- 只运行声明依赖该 fact 的 projection；
- 无关 source 不重新请求；
- 无关 atom/selector/component 不 invalidated；
- 无关 Native section 不进入 domain batch。

owner replace：

- 允许一次全 owner bundle commit；
- commit 之后的 same-owner event 立即恢复局部路径。

### AC-09：体验

- 有 cache 的 owner switch 不出现完整 Home 空白闪烁。
- 无 cache 时显示 target owner skeleton，不显示旧 owner 数据。
- banner 能从 cache 首帧出现并在 live result 后局部更新。
- Native surface 不因数据更新丢失 viewport/local interaction state。

### AC-10：包边界与跨平台

- `native-components` 不 import `kit`、`kit-bg` 或 app business module。
- `kit-bg` 不 import `kit/components`。
- Desktop/web 不使用 Native 同步 cache 假设。
- main/bg 序列化与独立初始化假设在测试和日志中明确。

## 9. 必需测试

### Unit

- session ID 每次 transition 唯一。
- reducer owner replace 不原地修改旧 owner Store。
- prepared cache 含 critical/banner/portfolio。
- eager non-section cache hydrate/remember。
- cache key 与 session execution key 分离。
- stale cache、live result 和 late cache revision/CAS。
- projection arrival-order permutation。
- banner intermediate/final semantic no-op。
- selector reference stability。

### Controller / wrapper

- 同 frame updates 只产生一次 flush。
- 同域 generation gap 可直接应用。
- 不同域 authority revision 互不阻塞。
- 新增 inline tab 同批次发布完整 section。
- owner churn 在 flush 前只提交最终 snapshot。
- stale/malformed domain batch 被忽略或拒绝。
- slot bundle 提交后立即展示。
- parent 切到新 owner 时旧 staged slot 不反压。
- staged replacement owner 可在 parent rerender 前展示。

### Native

- iOS/Android snapshot/domain owner 和 generation 校验。
- duplicate/stale domain 内部忽略且不产生反向成功事件。
- generation gap 直接应用；invalid invariant 不产生 recovery request。
- rendered state 只在 selected page layout/pre-draw 完成后更新。
- intent 使用内部 rendered owner/revision。

### Integration

- warm A -> B -> A。
- cold owner switch。
- cross-wallet switch。
- banner local-first、remote-first、referral slow、safety error。
- cache hit + live no-op。
- cache hit + live changed。
- old non-abortable leaf 在新 session 期间完成。
- global fact 只更新相关 projection。
- 20 updates/frame 和 20 owner transitions 的 transport counter。

## 10. 性能与可证明性

必须在 Release 构建记录：

- owner prepare 读取/解码耗时；
- prepared cache -> Store commit 耗时；
- React render/commit count 与耗时，按 component/selector 标记；
- source logical admission、leaf queued/running high-water mark；
- 每 source physical request 数；
- Store commit/no-op 数；
- Native scheduled flush、full snapshot、domain batch、slot-only render 数；
- serialized field/change 数与序列化耗时；
- owner switch 到 first cached content、first live content、banner visible 的时间；
- stale-owner result rejection 数；
- memory before/after settled churn。

基线场景：

1. warm owner cache，普通 banner 已缓存；
2. cold owner，无 banner cache；
3. remote banner 慢；
4. referral 慢；
5. A -> B -> A；
6. 20 次同 frame progressive update；
7. 20 次 flush 前 owner churn；
8. portfolio-only、banner-only、global-facts-only event。

通过条件：

- warm owner switch 的 first cached content 不慢于修改前，并且不经过空 Home；
- cache 立即读取的同步耗时、React commit 和 Native slot/transport 总耗时必须分别
  报告，不能只测 storage read；
- 与基线相比，无关 component render count 不增加；
- 每 frame Native submission 不超过 1；
- 物理请求数不因 progressive publication 增加；
- leaf running/pending high-water mark 不超过现有限额；
- settled 后旧 session queued/running 归零；
- 五轮 settled churn 后 memory 不单调增长。

如果立即 cache decode 被 Release 数据证明为显著瓶颈，再基于 profile 优化
schema、索引或 decode 路径；不能预先用不可验证的体积上限回避 SWR。

## 11. 当前分支 transport 最终结构

- 只保留 protocol v3；V1/V2 model、parser、fixture、test 和 native apply
  分支均已删除，不协商旧协议。
- Nitro 只暴露 `setSnapshot()` 与 `setDomains()`；没有 `applyPatch()`、
  `onSnapshotRequired`、ACK、deadline、timeout recovery 或 retransmission。
- owner attach/replace 发送一个完整 snapshot。旧 session 的 pending domain
  在 owner replace 时被清除。
- same-owner 使用 `shell`、`navigation`、`section:<tabId>`、`surface` 四类完整
  域值。每域由 controller 维护独立单调 generation；允许跳号，只拒绝同域旧值。
- Store commit 与 command-authority revision 只用于数据来源和 intent authority，
  不再充当 Native body 的传输序号。
- portfolio 与 market 可以共同触发 portfolio 域的新 generation，不再用两者
  Store revision 的最大值猜测传输先后。
- 同 frame 每域只保留最后值，并最多提交一个 domain batch；不同域的 authority
  revision 不互相阻塞。
- React slot 独立发布，React 合并或跳过中间 render 不会阻塞 Native body。
- Native rendered state 仍服务于 intent authority，不跨桥通知 JS。
- Nitro codegen 已重新生成。

当前验证：

- `packages/native-components` TypeScript 通过。
- 相关 Jest 4 suites / 14 tests 通过。
- Android JDK 17 protocol v3 / market contract tests 通过。
- iOS protocol v3 fixture contract 通过。

## 12. 当前分支改造与测试结果

### 12.1 已实施

1. Native surface 与 owner 解耦：
   - `HomePageContainer` 不再给 Native Home 使用 owner-derived React key；
   - `MobileNativeHomeBridgeRuntime` 在 surface 生命周期内只创建一次；
   - owner change 调用 `replaceOwner()`，清除旧 owner 的 revision 和 section，
     但复用同一个 controller、Native host 和已挂载 Slot；
   - 已挂载 Slot 在新 session 下重新签发 owner/commit authority，不保留旧
     `sessionId`，也不经过“先清空 Slot、再等待各 bridge 重注册”的空窗；
   - iOS owner full snapshot 禁用普通资产/DeFi 差异动画，避免跨 owner row 被
     误判为同 owner 的展开/收起动画；同 owner 渐进更新动画保持不变。
   - Android owner change 不再把 `ViewPager2` adapter 置空或 recycle 已挂载
     page，也不再归零 collapse/scroll offset；仅清除旧 owner 的待执行 pager
     selection、render wait 和 refresh authority。
2. owner 与 prepared cache 原子提交：
   - 每次 owner transition 先生成新的 `sessionId`；
   - 旧 session 的 scheduler、queued leaf、sink、commit budget 和 command 在 cache
     prepare 前取消；
   - Native 使用同步 prepared reader 读取 target critical、banner 和 portfolio；
   - cache hit 时 owner、session、shell、navigation 和 records 在一个 Store commit
     中安装；cache miss 才安装 target owner loading；
   - URL Account mode 不读取 wallet display cache。
3. SWR 补齐：
   - persisted Native prepared snapshot 包含 banner 和 portfolio；
   - in-memory cache hydrate/remember 覆盖 banner、capability 和 section source；
   - cache key 可跨 session，execution key 显式包含 `sessionId`；
   - `cancelSession()` 只清除对应 session 的 loaded/in-flight/queued work；
   - stale cache revalidation failure 保留数据并标记 `refresh: failed`；
   - safety unknown 不再折叠成 safe。
4. banner 渐进发布：
   - remote、local、bot status 和 referral 不再构成首次 publication 的
     `Promise.all` 屏障；
   - local 或 remote 任一 ready 即可发布 ordinary banner；
   - referral 使用 background leaf priority；
   - `Promise.allSettled` 仅等待 workflow 终态，不阻塞已可见 intermediate；
   - semantic fingerprint 和 Store equality 阻止相同 intermediate/final 重复
     commit；
   - facts、banner 或 balance 后续变化都会重新运行 balance/banner projection。
5. 局部读取与局部更新：
   - dispatcher 不再在每个 event 前调用 `readHomeStoreState()`；
   - reducer 和 source orchestrator 获得惰性 Store view，只读取当前路径实际访问
     的 atom；
   - atomic batch 内用 mutation overlay 让后续 event 看到前一 event 的结果；
   - owner replacement 仍是唯一允许 reset 全部 owner-scoped slice 的路径；
   - unchanged resource/section atom 不写入，因此无关 subscriber 不 rerender。
   - 持久化和显式 snapshot API 仍使用全量读取，因为它们本身就是 owner bundle
     边界。
6. 并发和 transport：
   - scheduler running 上限保持 4；Native shared leaf running 上限保持 4；
   - 同 execution key 的 force refresh 也不复制正在运行的物理请求；
   - polling 遇到同 source in-flight 时跳过；
   - optional referral 不使用 critical leaf priority；
   - controller 使用 RAF、测试环境使用 microtask，把同 frame 更新合并成一次
     latest-wins submission；
   - slot-only 更新不提交 Native body domain；
   - 正常路径没有 ACK、timeout、retry 或成功回调。
7. Home display cache 不再配置单记录 byte hard limit。底层 storage 的
   `maxRecordBytes` 改为可选；Home 的 Native/Web repository 均不传该值。精确
   key 读取和 `maxReadBatchSize = 4` 仍保留，后者控制调用批次，不限制 payload
   体积、row 或 item 数。

### 12.2 三项重点确认

#### 立即读取 cache 是否是性能卡点

当前自动化测试证明的是提交和重渲染边界，不是 Release storage 性能：

- mocked Native prepared hit 从 `replaceOwner()` 到断言完成的 Jest 用例为约
  `3–4 ms`；
- target session 只观察到一个 React frame，该 frame 已是 cached shell +
  cached banner；
- 没有观察到 target owner loading frame；
- 该数字使用 mocked repository，不能推断 MMKV 读取、JSON decode、React
  commit 或 Native layout 的真实耗时。

因此当前没有证据证明“立即读取并发布 cache”是性能卡点，也没有用体积阈值
规避它。最终结论必须由第 10 节的 iOS/Android Release 分段指标给出。

#### 当前架构能否让 SWR cache 立即发布

可以，但结论按平台区分：

- iOS/Android main runtime 使用 `.native` 同步 prepared reader；cache hit 能在
  owner replacement 的同一个 Store transaction 中发布，不等待 bg ready 或
  网络；
- bg 有独立 JS heap，bg 内存对象不能直接作为 main 的可渲染 cache；
- Desktop/Web 是 single runtime，但 repository API 为异步，owner 先进入 target
  loading，再由 owner/session CAS 发布 cache；共享代码没有引入 Native 同步
  假设；
- 任一迟到 cache/live result 都必须通过 scopeKey + fresh sessionId authority，
  不能覆盖当前 owner。

#### Native transport 为什么曾可能产生快照洪流

根因不是缺少 ACK，而是多个独立 producer 在一个渲染周期内分别推进
shell、navigation、section 和 slot；如果每次推进都立即跨桥，渐进 publication
会被放大为多次全量提交，rapid owner churn 也可能保留中间 staged owner。

当前控制点是：

- controller 每 frame 只安排一个 flush，并在 flush 时读取最后域值；
- 同一 frame 的同域写入覆盖 pending value，不累积中间 snapshot；
- owner churn 在 flush 前只保留最终 owner full snapshot；
- same-owner updates 发送完整域值，不依赖连续增量；
- slot-only 更新不提交 Native body；
- semantic no-op 不提交；
- 只有跨多个 frame 的真实语义变化才允许每 frame 各一次 submission；
- Native 可直接忽略同域旧 generation，没有双向确认、异常恢复请求或重传。

### 12.3 自动化观测

- Jest：28 suites / 141 tests 全部通过。
- owner cache hit：target owner React frame 数为 1；首个 target frame 已包含
  `banner: ready` 和 portfolio shell。
- portfolio-only event：portfolio subscriber `+1`，banner subscriber `+0`。
- banner-only event：banner subscriber `+1`，portfolio subscriber `+0`。
- global visibility event：banner、portfolio data subscriber 都是 `+0`。
- portfolio local event 的实际 read set 包含 portfolio resource/section，不包含
  banner、NFT 或 shell atom。
- 20 次同 frame v3 progressive update：scheduled Native submission 为 1，内容
  是最后一次更新。
- 20 次 flush 前 owner replacement：full snapshot submission 为 1，只包含最终
  owner。
- queued old-session leaf cancellation：只移除旧 session queue，新 session work
  保留；running work 仍计数到 settle。
- TypeScript：`packages/kit` 和 `packages/native-components` 均通过。
- 改动 TS/TSX：Oxlint 0 warning/error，Oxfmt check 通过。
- Android：JDK 17 下 protocol v3 与 market contract tests，以及
  `:onekeyhq_native-components:compileDebugKotlin` 通过。
- iOS：HomeContainer 指定 Swift 文件 parse 通过；唯一的 protocol v3 fixture
  contract 编译并运行通过。
- iOS 26.5、iPhone 17 Pro Debug 模拟器：
  - 原生工程重新编译、安装和启动成功，0 error；
  - Account #1 -> #2 与 #2 -> #1 往返切换后，账户 Header、余额、操作区、
    Tabs 和 Token 列表在首个采集帧、300 ms 帧与 settled 帧持续存在；
  - 未观察到整页空白、整页 Skeleton、Header 丢失或新旧 token row 重叠；
  - #1 的 cached banner 在切回后的首个采集帧已可见，未等待 referral 或网络
    workflow 终态；
  - 本轮 UI 验证曾发现并修复两项自动化未覆盖的缺口：Slot contributions 被
    owner replacement 清空导致 Header 永久缺失，以及 iOS Diffable 将跨 owner
    资产变化错误执行 180 ms 动画。
- 最终 UI/Native 补丁后，14 个直接受影响的 Jest suites、59 个 tests 已再次
  全量通过；此前完整相关集合仍为 28 suites / 141 tests 全部通过。

测试中只有现有 `react-test-renderer is deprecated` warning，没有失败。

### 12.4 2026-07-27 六项缺口收口

本轮针对 Account #2 -> Account #3 的真实首帧问题补齐了以下约束，改动仍保持
`main Store -> React bridge -> Native renderer/protocol` 的现有单向架构：

1. banner 不再依赖余额 verdict：
   - banner 是否可见只读取 banner resource 的可展示内容；
   - loading、zero、funded 和 error projection 都分别携带 banner presentation；
   - confirmed-cache 的 zero shell 也可以同时显示 positive banner。
2. 未知总额不再伪装成零：
   - display policy 删除了“已知币种即构造 provisional 0”的分支；
   - `accountTokensValueAvailable` 和 `accountTokensValueComplete` 必须显式为
     `true`，缺失或 `false` 都不能形成 definitive zero；
   - Add Money 只来自完整、可用且最终确认为零的 live/confirmed result。
3. target owner 首帧不再收缩：
   - prepared snapshot 同步安装 target owner 自己的 banner、portfolio rows 和
     shell；
   - 不保留旧 `sessionId`，也不把旧 owner Store 原地修改为新 owner；
   - cache miss 仍显示 target loading，不允许借用 previous owner 数据。
4. 高质量 display snapshot 不再被低质量 intermediate 覆盖：
   - prepared shell 优先由同 generation 的完整 portfolio source record 重建，
     不再优先采用可能更旧的 critical projection；
   - portfolio record 存在但 completeness 未知时，拒绝使用旧 critical zero；
   - same-owner confirmed/live funded total 遇到
     `loading`、`unavailable` 或 `fundedPendingTotal` 时保留原余额和 action，
     只推进 banner 与 refresh 状态；完整 live result 仍可替换它；
   - intermediate phase 继续保留在 sink -> Store commit 路径中，不能降级
     ready/empty resource。
5. All Networks intermediate publication 有确定的节流与本地证据：
   - leaf 并发上限仍为 4；
   - local cache 只允许首个非空批次发布一次；
   - live progress 每处理 12 个 target 最多发布一次；
   - `defaultLogger.wallet.homeUi.homePortfolioProgress` 只记录
     publication kind、mode、processed target、response 和 row count，不记录
     owner、地址、余额或 payload；
   - 本次 iOS All Networks 实测只出现两次语义 publication：
     `localCacheIntermediate(processed=4, responses=4, rows=36)` 和
     `liveIntermediate(processed=12, responses=12, rows=50)`，没有每 4 个
     target 一次的 Store/Native 洪流。
6. Native transport 保持无 ACK 的单向提交模型：
   - Header intent authority 继续使用 Store command revision；
   - Native body 使用 controller-owned per-domain generation，不复用 Store
     revision，也不等待 React slot revision；
   - iOS/Android 接受同域 generation gap，忽略同域旧值和 stale owner；
   - 没有 pending patch queue、ACK、snapshot recovery request、timeout、retry
     或成功回调。

最新验证结果：

- 真实 iOS Debug 切换录像：
  `.tmp/ui-six-fixes/final-account2-to-account3.mov`；
- protocol v3 per-domain Latest-Wins 改造后的同 wallet 往返录像：
  `.tmp/home-domain-v3-account-switch.mov`；
- Watch-Only Account #1 的首页 Perps 列表在切换后正常展示持仓；切换到
  Account #2、再返回 Account #1、最后切回 Account #2 后，Account #2 的
  Perps 稳定进入 `$0.00` 空态，没有永久 loading；
- 本轮运行日志中没有 `[NativeHome] render failed`、controller attach failure、
  owner mismatch 或 unsupported protocol；
- Account #3 首个采集帧直接显示 target cache 的 `$20.77`、funded actions、
  banner 和 token rows；1.5 秒帧与 settled 帧结构一致，没有 `$0.00`、
  Add Money、banner 空窗或列表收缩；
- React DevTools selection-only profile 为 16 个 app commit；
  `HomePageContainer` 2 renders / 0 mounts，
  `NativeHomeContainer` 6 renders / 0 mounts。该数据证明 container 没有销毁重建，
  但不作为 Release 性能基线；
- selector 自动化继续证明 portfolio local event 为 portfolio subscriber
  `+1`、banner subscriber `+0`，banner event 反向为 `+1/+0`，visibility global
  event 两者均 `+0`；
- 15 个直接相关 Jest suites、115 tests 全部通过；
- root TypeScript、受影响文件 Oxlint、Android JDK 17
  `compileDebugKotlin + testDebugUnitTest` 通过；
- iOS Native queue 改动已重新执行完整工程 build/install/launch，0 error。

### 12.5 尚未由本轮自动化证明

- Native host 的底层对象 identity 已由 controller/React key contract 测试
  覆盖，但 Debug UI 工具无法直接读取 UIKit 对象地址；
- scroll position、gesture 与 selected tab 连续切换体验；
- warm/cold、跨 wallet 和 network scope 的完整 UI 矩阵；
- 真实 MMKV read/decode、Store commit、React commit、Native layout 分段耗时；
- 五轮 A -> B -> A settled churn 后的内存曲线；
- Release 下 leaf high-water、物理 RPC 数和跨多 frame submission 统计；
- 无 cache、remote banner 慢、referral 慢、safety error 的真实视觉状态。

这些项目继续按第 10 节采集。未完成前，当前结论是“代码与自动化 contract
通过”，不是“Release 体验与性能完成验收”。

### 12.6 Owner switch 骨架布局契约

2026-07-27 的 iOS 实机验证发现 loading action row 误用了 zero-balance
内容所需的 `98pt`，而 funded action row 的完成态高度是 `62pt`。这会把
Banner 和 Tabs 整段向下推 `36pt`，视觉上看起来像 action row 与 Banner
同时变高。

当前约束为：

- loading 与 funded/standard action row 都使用 `62pt`；
- zero-balance action row 仍使用 `98pt`，用于容纳提示文案和 Add Money；
- backup prompt 隐藏 action row，高度为 `0`；
- Banner loading/content 共用同一个 Native row，高度为 `88pt`；
- initial snapshot 也必须使用 `62pt`，不能在 producer 首次提交前先发送
  `98pt`。

iPhone 17 Pro、iOS 26.5 Debug 验证结果：

- loading action skeleton frame：`x=20, y=260, width=362, height=62`；
- funded Send action frame：`x=20, y=260, width=83, height=62`；
- content Banner frame：`x=20, y=343, width=280, height=88`；
- loading 与 funded 两种状态下 Spot Tab 均为 `y=472, height=36`，没有纵向
  位移；
- iOS 完整工程 build/install/launch 为 0 error；Android
  `compileDebugKotlin + testDebugUnitTest`、root TypeScript、定向 Jest、
  Oxlint/Oxfmt 均通过。

## 13. 完成定义

只有同时满足以下条件才算完成整体问题：

1. Native surface 在所有 owner switch 场景保持 identity。
2. target prepared cache 与 owner-scoped Store 原子提交。
3. banner/capability 获得与 section source 一致的 SWR。
4. session execution state 不跨 owner transition 泄漏。
5. banner projection 与 arrival order 无关。
6. ordinary banner 不再被 optional dependency 的整体等待阻塞。
7. stale/fresh/error provenance 可观察且无覆盖竞争。
8. 局部 Store/React/Native 更新由 read/write/render/transport counter 证明。
9. 既有并发上限保持，通信量满足每 frame latest-wins 约束。
10. Release 指标证明 cache-first 改善体验且无性能倒退。
