# OneKey DeFi 分析 — 数据需求

> 日期: 2026-04-14
> 上游: [DeFi 覆盖与潜力分析方案](./2026-04-14-defi-coverage-analysis-framework.md)

分析的基础单位是 **用户 (User)**,通过钱包共现图的连通分量 (Union-Find) 聚合识别;每个用户需可区分活跃状态(7 天 / 30 天 / 1 年 / > 1 年)。用户名下的资产按 `wallet_id` 分类,包含三类:

1. **钱包裸持仓** — 每个钱包在各链各 token 的数量及 USD 本位价值
2. **外部 DeFi 持仓** — 接入 debank,保留协议名称、协议类型、仓位数据(yield / supply / deposit 类需可识别)
3. **OneKey DeFi 持仓** — 内部 Earn / Borrow 等产品数据,同样按 user 粒度可取

三类数据汇总为用户级资产时,三源 snapshot 的时间差必须 ≤ **72 小时**,超过视为 stale 不进入分析。所有跨用户 / 跨 token 的聚合按 **USD 本位**。
