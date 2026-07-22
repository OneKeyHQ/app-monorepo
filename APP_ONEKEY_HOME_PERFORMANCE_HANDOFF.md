# app.onekey.so 首页性能评估 Handoff

## 1. 目标与当前结论

目标是评估 `https://app.onekey.so/` 的首页加载性能，并测算 FCP 前的资源下载量和有效下载速度。

生产首页会从 `/` 跳转到：

```text
https://app.onekey.so/market
```

当前结论：

- 热缓存重载很快，但首次冷启动明显偏慢，移动环境尤其严重。
- 服务端 HTML 的 TTFB 不是主要瓶颈；主要成本位于首屏 JS 下载/执行、字体、移动列表过度挂载以及资源失败回退。
- 在固定的 3.56s 窗口内，已经传输了整页最终流量的约 87%，其中约 90% 是 JS 和字体。
- 页面稳定后的标签切换响应较快，主要问题集中在启动阶段。

## 2. 运行时范围

本次测量只覆盖 Web 页面 renderer：

- Runtime scope：单个 Web renderer JS runtime。
- Native resource ownership：不涉及 OneKey 原生 `main`/`bg` 共享资源。
- JS heap copies：只有页面 renderer 的一份 JS heap；不涉及 main/bg 双份反序列化。
- Timing/order：只测浏览器页面启动，不对原生 main/bg 初始化顺序作任何假设。

## 3. 测量环境

- 测量日期：2026-07-13，Asia/Shanghai。
- 浏览器：Google Chrome 149.0.7827.201。
- 机器：Apple M4 Pro，arm64。
- CDN 路由：本次响应经过 Singapore edge，结果可能受地区和边缘节点波动影响。
- 桌面视口：1440 × 900，无 CPU/网络限速。
- 移动视口：390 × 844。
- 移动网络：下载 1.6Mbps、上传 750Kbps、RTT 150ms。
- 移动 CPU：Chrome DevTools 4× CPU throttling。
- 冷启动样本：每组 3 次，使用新 browser context。
- FCP 3.56s 网络窗口复测：5 次，取中位数。

## 4. 首页冷启动基线

以下是最初三次冷缓存测量的中位数：

| 场景 | TTFB | FCP | LCP | CLS | 长任务阻塞量 | 流量 | 请求数 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 桌面冷缓存 | 0.51s | 3.56s | 7.91s | 0.097 | 1.16s | 5.21MiB | 313 |
| 移动 4G + 4× CPU | 0.55s | 12.04s | 14.78s | 0.070 | 13.95s | 7.03MiB | 508 |

样本范围：

- 桌面 FCP：3.35–3.86s。
- 桌面 LCP：6.08–9.10s。
- 移动 FCP：12.03–13.36s。
- 移动 LCP：14.24–16.45s。
- 桌面热缓存重载：TTFB 0.19s，FCP 0.58s。

注意：

- 长任务阻塞量按采集窗口内所有超过 50ms 的长任务计算，窗口比 Lighthouse 默认 TBT 更长，不能直接当作 Lighthouse TBT 分数。
- 请求数和总流量统计到 `load` 后约 8 秒，因此包含 LCP 后的动态请求、图片加载、埋点和第三方组件；这些请求不一定都阻塞 LCP，但仍会争抢网络和主线程。
- 这是实验室数据，不是 CrUX/RUM 的 p75 Core Web Vitals，不能直接声明真实用户 CWV 是否通过。

## 5. FCP 3.56s 窗口资源测算

最初的完整 trace 没有保留逐请求时间戳，因此不能从旧 trace 精确恢复“3.56s 当时”的资源状态。随后使用相同桌面冷缓存配置，对固定的 `navigationStart → 3.56s` 窗口重放 5 次，取中位数。

结果：

| 指标 | 中位数 |
| --- | ---: |
| 已发起请求 | 191 |
| 已收到响应 | 183 |
| 已完成请求 | 183 |
| 估算线上传输字节 | 4.53MiB / 4.75MB |
| 从 navigationStart 计算的平均有效速度 | 1.27MiB/s / 10.7Mbps |
| 排除约 0.52s TTFB 后的平均有效速度 | 约 1.49MiB/s / 12.5Mbps |

代表性中位样本的资源构成：

| 类型 | 传输量 | 占比 |
| --- | ---: | ---: |
| JavaScript | 3.24MiB | 71.6% |
| Font | 0.85MiB | 18.8% |
| Other | 0.39MiB | 8.6% |
| Image | 0.021MiB | 0.46% |
| Document | 0.012MiB | 0.27% |
| XHR | 0.008MiB | 0.19% |
| Stylesheet + Fetch | <0.005MiB | <0.1% |

计算口径：

- 完成的请求使用 CDP `Network.loadingFinished.encodedDataLength`。
- 尚未完成的请求使用 FCP 窗口内 `Network.dataReceived.encodedDataLength`，避免与完成请求重复计数。
- 平均速度是“页面观测到的有效吞吐”，包含请求调度、连接等待和主线程节奏，不等于运营商链路峰值带宽。
- `4.53MiB / 5.21MiB ≈ 87%`，说明绝大部分字节在 FCP 前已传输；问题不是只有 FCP 后的图片流量。

复测期间 FCP 本身存在约 1.95–3.44s 波动，证明 CDN/网络状态会显著影响单次结果。应以固定窗口和多样本中位数为准，不要只拿一次 trace 下结论。

## 6. 已确认的瓶颈

### 6.1 首屏 JavaScript 过重

- 桌面完整加载：约 158 个 Script 请求，压缩后约 3.55MiB。
- 移动完整加载：约 166 个 Script 请求，压缩后约 3.88MiB。
- 解压后的脚本源码约 16.2MiB。
- 脚本执行中位数：桌面约 1.82s，移动 4× CPU 下约 12.61s。
- 在 3.56s 的 FCP 窗口内，JS 已传输 3.24MiB，占所有传输的 71.6%。

这说明应优先分析 `/market` 的初始依赖图、同步 import、barrel import、跨路由共享 chunk 和启动初始化，而不是先优化 FCP 后才加载的图片。

### 6.2 字体预算偏大

首屏加载三个 Roobert TTF：

- `Roobert-SemiBold`：约 298KB。
- `Roobert-Medium`：约 297KB。
- `Roobert-Regular`：约 296KB。
- 合计约 0.85MiB，占 FCP 窗口传输的 18.8%。

建议改成子集化 WOFF2，并评估首屏是否真的需要三个字重。

### 6.3 移动市场列表过度渲染

移动 DOM 审计结果：

- DOM 节点约 5,800。
- `<img>` 元素 382 个。
- 310 个图片节点处于渲染状态。
- 只有 17 个图片位于视口内。
- 293 个渲染图片位于视口外。
- 所有图片 `loading` 都是默认 `auto`，没有 lazy loading。
- 完整加载产生 216–220 个图片请求，约 1.7MiB 图片流量。

这个问题主要影响 FCP/LCP 后半段、移动 load event、内存和滚动性能。修复时必须做到真实 DOM 虚拟化，并延迟设置图片 `src`；只加 `content-visibility` 不足以阻止网络下载。

### 6.4 图片资源失败和回退链

中位样本：

- 桌面失败请求约 59 个。
- 移动失败请求约 178 个。
- `static.oklink.com` 主要出现 `ERR_CONNECTION_CLOSED`。
- `uni.onekey-asset.com` 部分资源出现 `ERR_BLOCKED_BY_ORB`。

这会造成重复请求、回退延迟和大量控制台噪声。需要检查源站稳定性、Content-Type、CORS/ORB，以及是否同时挂载主图和 fallback 图。

### 6.5 Service Worker 发布异常

生产页面会在 `apps/web/index.js` 中注册：

```text
/service-worker.js
```

本次测试中该地址返回 HTML/403，浏览器控制台报告：

```text
The script has an unsupported MIME type ('text/html').
```

相关源码入口：

- `apps/web/index.js` 中的 `ROOT_SERVICE_WORKER_PATH`。
- 同文件 production-only `navigator.serviceWorker.register(...)` 逻辑。

需要核对部署产物是否真正包含 JS 文件、Cloudflare/WAF 规则是否拦截，以及响应 `Content-Type` 是否正确。

## 7. 功能和视觉验证

- `/` 成功跳转到 `/market`。
- 页面标题为 `OneKey - Market`。
- Market 表格展示真实币价、涨跌、成交额等内容，不是只出现 DOM 或骨架。
- 桌面和移动初始视口没有横向溢出。
- 移动底部导航和主要筛选控件可见。
- 桌面切换 US Stocks、Trending、Perps 后状态和内容发生变化。
- 稳定后抽样事件耗时为 32–64ms；这是本地交互样本，不等同真实用户 p75 INP。

## 8. 建议的修复顺序

### P0

1. 分析并削减 `/market` 初始 JS 依赖，目标压缩后首屏 JS 小于 2MiB。
2. 将 Perps、DeFi、Trade、Intercom、非首屏 Sentry/analytics 逻辑延迟到路由访问、用户意图或 idle 阶段。
3. 对移动 Market 列表实施真实虚拟化；图片进入可视区/overscan 后才设置 `src`。
4. 修复图片主源和 fallback 失败链，确保 Content-Type/CORS/ORB 正确。
5. 修复 `/service-worker.js` 的发布路径、WAF 和 MIME。

### P1

1. 字体改成子集化 WOFF2，减少首屏字重。
2. 合并静态配置请求，延迟非关键 API，请求并发控制在 3–5。
3. 若资源削减后 FCP 仍高，继续检查 Web 启动 hydration、同步持久化读取和首屏 render 前 gate。
4. 要达到移动 LCP 2.5s，需要考虑预渲染/SSR 首屏框架和关键 Market 数据，而不只是继续拆小 chunk。

粗略带宽收益：在 1.6Mbps 下，每减少 1MiB 约释放 5.2s 原始传输预算；并行下载后不能直接等同 LCP 改善。JS、图片、字体合计若减少约 3MiB，移动端可释放约 15s 原始带宽预算。

## 9. 原始证据

完整性能数据：

```text
/Users/huhuanming/.codex/visualizations/2026/07/13/019f5acd-d788-75a3-b1f9-6a1ac599d5ff/onekey-home-performance.json
```

FCP 网络窗口数据：

```text
/Users/huhuanming/.codex/visualizations/2026/07/13/019f5acd-d788-75a3-b1f9-6a1ac599d5ff/onekey-fcp-network.json
```

截图：

```text
/Users/huhuanming/.codex/visualizations/2026/07/13/019f5acd-d788-75a3-b1f9-6a1ac599d5ff/onekey-home-desktop-cold.png
/Users/huhuanming/.codex/visualizations/2026/07/13/019f5acd-d788-75a3-b1f9-6a1ac599d5ff/onekey-home-mobile-fast4g-cold.png
```

## 10. 下一 session 建议起点

1. 先阅读本文件和两个 JSON，不要只依赖聊天摘要。
2. 在修改代码前重新跑至少 3 次生产基线，确认生产 build hash 和 CDN 路由是否变化。
3. 优先定位移动 Market 列表实际使用的组件和 Web 渲染路径，验证为什么挂载了 382 个图片节点。
4. 使用 bundle analyzer 或构建 stats 还原 `/market` 初始 3.5MiB JS 的模块归属。
5. 将优化拆成独立变更：列表虚拟化、图片源修复、字体、Service Worker、路由拆包，避免难以归因。
6. 每个变更都复测 FCP、LCP、FCP 前传输量、Script 数量、DOM 节点和失败请求数。

## 11. 仓库状态说明

- 本次性能评估没有修改任何现有业务代码。
- 测试用临时 Playwright 脚本已删除。
- 仓库在开始评估前已经存在大量用户改动和未跟踪文件；下一 session 必须保留这些改动，不能 reset 或覆盖。
- 本 handoff 文档是本次唯一新增的仓库文件。
