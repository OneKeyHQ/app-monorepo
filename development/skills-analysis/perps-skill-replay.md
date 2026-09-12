# Perps Skill Maintenance Replay

This is an optional maintenance aid for changes to `1k-perps-module`, not a gate for ordinary Perps development. Keep it outside the skill's default reading path. It evaluates navigation, factual accuracy and task scope; it does not prove app behavior or replace relevant runtime checks.

## Run a comparable read-only check

1. Use the same code revision and dependency state. Preserve the previous skill text before editing. Record any working-tree or installation differences that limit the comparison.
2. Give separate, fresh evaluators the same requests below: no Perps guidance, the previous skill, and the candidate skill. They may read the assigned skill's references on demand and inspect code. Do not give them expected owners, earlier answers or personal notes. If evaluating a single case, provide only that case.
3. Ask for first investigation paths, code evidence, the smallest relevant validation plan, whether missing context actually blocks progress, and the files read. Distinguish paths supplied by the skill from paths discovered by code search. Keep these runs read-only: no app mutation, external calls, tests or trading are needed for this exercise.
4. Compare actual decisions and supporting evidence. Check documented message/event names against receivers as well as checking file paths. Keep the raw outputs with the maintenance record; do not convert one run per variant into a statistical success rate or infer full-file token consumption from a filename list.
5. Correct factual mistakes or excessive scope, then repeat affected cases when the correction changes their guidance. Use existing repo checks for the documentation change. No new CI job or mandatory business-task workflow is implied.

## Requests

1. Desktop Perps 的资金费列表只需要调整一处行间距。请定位修改入口和合适的验证范围。
2. Perps 充值弹窗已经关闭，用户随后才完成 Unifold 入金，但没有看到到账提醒。请给出第一轮排查路径。
3. 移动端切换交易对和订单簿档位后偶尔不能点击价格。冷启动缓存能显示，实时推送也已恢复。请给出第一轮排查路径。
4. Perps 的 Chase 改价需要检查实际 SDK 支持和请求字段。请定位契约来源和应用适配层。
5. 用户锁定再解锁 App 后 Perps 显示需要重新启用交易。请区分应检查的状态与签名路径。
6. Android Perps 切换交易对出现短暂白屏。请定位图表切换行为和需要验证的端。
7. 普通 Swap 的 Relay pending 状态不更新，未涉及 Perps。请说明是否使用 Perps skill 和下一步定位。
8. 维护一个没有 Unifold/Fast L2 实现的旧分支，修复 Perps 账户切换时的旧持仓显示。请说明如何定位和确定改动范围。

## Review the outputs after the run

- Does the evaluator use the working branch's real owner and distinguish a navigation hypothesis from a proven root cause?
- Does it retain local UI/selector fixes and reasonable refactors, without freezing ownership or adding unrelated SDK research, approvals or all-platform tests?
- Does it reuse already supplied context and authorization, and ask only when missing information prevents a correct next step?
- Does it keep generic Swap/Market out of Perps and adapt to feature availability in an older branch?
- Are provider identity, cached display versus interaction, SDK patch/runtime support, status versus signing, and chart/platform readiness handled accurately where relevant?
- Is the validation plan tied to changed behavior, with secret handling and production-action authorization preserved?

For changes outside these requests, choose an affected scenario such as an older branch's credential lifecycle, a changed signing/payload contract with insufficient evidence, Relay pending, cold-start close-position pricing, account-mode/funding data, top-chart sizing or a justified cross-layer refactor. Avoid growing an unconditional full-module checklist. Refresh this aid when provider ownership, subscription transport, credential lifecycle or platform behavior materially changes; a date label alone is not evidence of accuracy.
