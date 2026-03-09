# Pendle Feature Session Memory

> 分支：`feat/pendle` → `x`
> 状态：**APPROVED FOR MERGE** (Session 13 通过，Session 15/16 确认)
> 完成度：100%
> 历史 Session 详情见 `MEMORY_SESSIONS_ARCHIVE.md`

---

## Session 16 — Pipeline Review v3 (Review-Only Mode)（2026-03-02）✅

**报告**：`reviews/pipeline_review_final_v3.md`

| 维度 | 结果 |
|------|------|
| P0/P1 issues | 0 |
| P2 issues | 6 (non-blocking, deferred) |
| DTO Alignment | PASS — 11 endpoints, 55/55 checks |
| Lessons Learned | PASS — 10/10 items |
| Non-target Regression | PASS — 13/13 guards |
| Figma | PASS — R1-R8 + incremental |
| Runtime API | PARTIAL — Pendle backend offline |

Skill 演化验证：review-only 模式正常运作，未尝试修复。v3 确认 v2 全部发现。

---

## Session 15 — Pipeline Review v2（2026-03-02）✅

**报告**：`reviews/pipeline_review_final_v2.md` — 与 v3 结论一致。

---

## Session 13 — Final Pre-Merge Review（2026-02-28）✅

**报告**：`reviews/FINAL_REPORT.md`
- P0: 0, P1: 6 (ALL CLOSED), P2: 5 (deferred)
- Runtime API: 10/15 PASS, 2 PARTIAL, 3 EXPECTED failures

---

## Session 14 — 走查修复（2026-02-28）✅

18 files, +550/-200。改动：
- 图表 Hover 双线 tooltip（Fixed APY / Base APY）
- 代币搜索全屏 Modal（`EarnTokenSelect` + `pushModal`）
- `RefreshCooldownButton` 5s 冷却
- 经验教训 → LESSONS_LEARNED #13-15

---

## Session 12 — 评审 + 调试链路（2026-02-27）✅

**报告**：`reviews/pipeline_review_session12.md`
- P0: 0, FE P1: 2（slippage 缺失、stakeInfoWithOrderId）, BE P1: 1（79001）

---

## All Sessions Summary

| Session | Date | Focus | Key Output |
|---------|------|-------|------------|
| 1-2 | 02-09~23 | 初始开发 + Code Review | 34 files, 8 Medium → all resolved |
| 3 | 02-24 | Withdraw Path + Token 刷新 | useEthenaCooldown 全链路 |
| 4 | 02-24 | Sell/Redeem 像素 + 外部 Review | 3 P1 fixes, 5 外部意见全不成立 |
| 5 | 02-24 | 非 Pendle 回归分析 | 10 隔离点验证，风险极低 |
| 6-7 | 02-24~25 | Figma R1-R8 全量像素 Review | 1 修复(GridItem), 其余全部匹配 |
| 8 | 02-26 | Quote Lifecycle + Slippage | useQuoteCountdown, SlippageSettingDialog |
| 9 | 02-27 | PT Convergence Chart | lightweight-charts Web + Native |
| 10 | 02-27 | Pipeline review | reviews/pipeline_review_session10.md |
| 11 | 02-27 | Chrome MCP + 全量复审 | 2 P1 + 2 P2 |
| 12 | 02-27 | 评审 + 调试链路 | 2 FE P1 + 1 BE P1 |
| 13 | 02-28 | **Final Review → APPROVE** | reviews/FINAL_REPORT.md |
| 14 | 02-28 | 走查修复 | Chart tooltip, token selector, refresh |
| 15 | 03-02 | Pipeline Review v2 | 0 P0/P1, 6 P2 |
| 16 | 03-02 | Pipeline Review v3 (review-only) | 确认 v2 发现 |

---

## Open Items

### P2（可后续迭代）
- WithdrawSection receive asset 无错误态
- WithdrawSection receive token selector 无 loading 态
- Sell early 3-step StakeProgress（需跟产品确认）
- APY Chart 时间选择器（后端无 period 参数）

### Backend Blockers
| ID | Issue | Owner |
|----|-------|-------|
| BE-01 | ETH mainnet `unstake/tx-confirmation` returns 79001 | Backend / Pendle API |
| BE-02 | New networks `evm--42161/9745/999` partial inconsistency | Backend |

### Post-merge
1. Pendle backend restore → full E2E with real wallet
2. BE-01 resolution
3. P2 items in follow-up iterations

---

## Key File Index

### Frontend
- `packages/shared/types/staking.ts` — IWithdrawBaseParams, IStakeTransactionConfirmation (withdrawPath, tip, confirmBoxes)
- `packages/kit-bg/src/services/ServiceStaking.ts` — API client, slippage passthrough
- `packages/kit-bg/src/vaults/impls/evm/settings.ts` — `pendleFlowConfig` static config
- `packages/kit/src/views/Staking/hooks/` — useQuoteCountdown, useQuoteRefresh, usePendleLayoutState, useIsPendleProvider
- `packages/kit/src/views/Staking/components/` — UniversalStake, UniversalWithdraw, PendleSharedComponents, PtConvergenceChart, RefreshCooldownButton

### Backend
- `~/Documents/code/OneKey/server-service-earn`
- `src/entity/earn/earn.dto.ts` — StakeParamsDTO, UnstakeParamsDTO
- `src/entity/pendle/pendle.service.ts` — withdrawPath, confirmBoxes

---

## User Preferences
- No trim/normalize on backend strings
- New features follow intake → dev → qa pipeline (`/my-feature-intake` → `/my-feature-dev` → `/my-feature-qa`)
- Personal skills use `my-` prefix
- Figma review uses `/my-figma-pixel-review`
- Review sessions output report and STOP (LESSONS_LEARNED #19)

---

## Wrong Answers Notebook

### 2026-03-09 — `TxConfirmActions.confirmText` 邻近逻辑漏审

**现象**
- 在修 `OK-51152` 的 loading / 串行流程时，改动了 [`packages/kit/src/views/SignatureConfirm/components/SignatureConfirmActions/TxConfirmActions.tsx`](/Users/fanzhao/Documents/code/OneKey/app-monorepo/packages/kit/src/views/SignatureConfirm/components/SignatureConfirmActions/TxConfirmActions.tsx)，但没有顺手审完整个 `confirmText` 分支。
- 结果遗漏了两个已有问题：
  - `signOnly` 分支调用了 `intl.formatMessage(...)` 但没有 `return`，按钮文案会错误落到默认 `Confirm`
  - 两段完全相同的 `discountPercent > 0` 条件并存，后一段 `wallet_discount_number` 是死代码

**为什么会犯**
- 这次注意力过度集中在“新引入的串行交易状态”和“第二步弹窗 loading”，把同一函数里紧邻的旧逻辑当成了稳定前提，没有做 touched-file 邻近审查。
- 我验证的是“新行为有没有通”，没有补一轮“被我改到的函数里，已有分支是不是自洽”的静态检查。
- 这是典型的“修主路径时忽略 adjacent logic”的错误，不是知识盲区，而是 review 边界收得太窄。

**以后怎么避免**
1. 只要改到已有分支函数，提交前必须从函数入口到返回值完整通读一遍，不能只盯 diff hunk。
2. 对按钮文案、状态映射、条件分支这类小函数，额外检查：
   - 每个分支是否 `return`
   - 条件是否互斥
   - 是否存在重复条件导致死代码
3. 如果 review 指出“pre-existing bug in touched file”，默认先验证属实，不要因为“不是这次引入”就跳过。
