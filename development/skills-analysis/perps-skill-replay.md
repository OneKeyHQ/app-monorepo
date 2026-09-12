# Perps Skill Maintenance Replay

This is an optional maintenance aid for changes to `1k-perps-module`, not a gate for ordinary Perps development. Keep it outside the skill's default reading path. It evaluates navigation, factual accuracy and task scope; it does not prove app behavior or replace relevant runtime checks.

## Run a comparable read-only check

1. Use the same code revision and dependency state. Preserve the previous skill text before editing. Record any working-tree or installation differences that limit the comparison.
2. Give separate, fresh evaluators the same requests below: no Perps guidance, the previous skill, and the candidate skill. They may read the assigned skill's references on demand and inspect code. Do not give them expected owners, earlier answers or personal notes. If evaluating a single case, provide only that case.
3. Ask for first investigation paths, code evidence, the smallest relevant validation plan, whether missing context actually blocks progress, and the files read. Distinguish paths supplied by the skill from paths discovered by code search. Keep these runs read-only: no app mutation, external calls, tests or trading are needed for this exercise.
4. Compare actual decisions and supporting evidence. Check documented message/event names against receivers as well as checking file paths. Keep the raw outputs with the maintenance record; do not convert one run per variant into a statistical success rate or infer full-file token consumption from a filename list.
5. Correct factual mistakes or excessive scope, then repeat affected cases when the correction changes their guidance. Use existing repo checks for the documentation change. No new CI job or mandatory business-task workflow is implied.

## Requests

1. Only one row-spacing adjustment is needed in the Desktop Perps funding history list. Identify the edit location and an appropriate validation scope.
2. A user completes a Unifold deposit after closing the Perps deposit modal, but no deposit-completion notification appears. Give the initial investigation paths.
3. On mobile Perps, tapping an orderbook price sometimes stops working after switching trading pairs and aggregation levels. Cached data is visible on cold start, and live updates have resumed. Give the initial investigation paths.
4. A Perps Chase price amendment needs verification of actual SDK support and request fields. Locate the contract sources and application adapter.
5. After locking and unlocking the app, a user is prompted to enable Perps trading again. Distinguish the state and signing paths that need investigation.
6. Android Perps briefly shows a blank chart when switching trading pairs. Locate the chart-switching behavior and identify which platform needs validation.
7. A regular Swap's Relay pending status is not updating; Perps is not involved. Explain whether to use the Perps skill and where to investigate next.
8. On an older branch without Unifold or Fast L2, fix stale Perps positions displayed after an account switch. Explain how to locate the cause and determine the change scope.

For optional Chinese keyword checks, replace `Perps` with `永续合约` and `orderbook` with `订单簿` where applicable, keeping the rest of the request unchanged.

## Review the outputs after the run

- Does the evaluator use the working branch's real owner and distinguish a navigation hypothesis from a proven root cause?
- Does it retain local UI/selector fixes and reasonable refactors, without freezing ownership or adding unrelated SDK research, approvals or all-platform tests?
- Does it reuse already supplied context and authorization, and ask only when missing information prevents a correct next step?
- Does it keep generic Swap/Market out of Perps and adapt to feature availability in an older branch?
- Are provider identity, cached display versus interaction, SDK patch/runtime support, status versus signing, and chart/platform readiness handled accurately where relevant?
- Is the validation plan tied to changed behavior, with secret handling and production-action authorization preserved?

For changes outside these requests, choose an affected scenario such as an older branch's credential lifecycle, a changed signing/payload contract with insufficient evidence, Relay pending, cold-start close-position pricing, account-mode/funding data, top-chart sizing or a justified cross-layer refactor. Avoid growing an unconditional full-module checklist. Refresh this aid when provider ownership, subscription transport, credential lifecycle or platform behavior materially changes; a date label alone is not evidence of accuracy.
