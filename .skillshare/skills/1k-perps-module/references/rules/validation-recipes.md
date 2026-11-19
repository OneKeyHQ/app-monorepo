# Perps Validation and Review

Use when choosing validation or reviewing a Perps change. Select evidence for the changed behavior; domain references list candidate tests and scenarios. Use existing repo checks without requiring a full-module suite.

## Match evidence to the change

| Change | Useful evidence |
| --- | --- |
| Copy, spacing, row formatting | Inspect the affected component and verify the relevant layout/locale; follow existing repo checks. No SDK survey, trading exercise or all-platform run just because the file is in Perps. |
| Pure calculation, parsing, identity or freshness logic | Relevant existing tests; add or adjust cases when behavior changes or a regression needs coverage. |
| Submit/modify/cancel/withdraw/signing | Payload/adapter tests plus applicable SDK or API evidence; use an authorized environment for external effects. |
| Subscription/cache lifecycle | Targeted tests and the affected switch/reconnect/foreground scenario; check identity and interaction readiness, not just visible ticker updates. |
| Chart/layout interaction | Affected platform and entry route; confirm actual rendering/readiness, state and interaction. Include another platform when shared behavior is affected. |
| Provider tracking/account state | Relevant identity, stale response and lifecycle cases from the matching reference. |

Use the repo's existing workflow:

```bash
yarn jest <relevant-test-file> --runInBand
yarn agent:check --profile commit
# Before PR readiness:
yarn agent:check --profile pr
```

Choose the test file from the changed area. Use lower-level lint/type commands only to diagnose a failed agent check, following `$1k-dev-commands`. Runtime setup follows existing repo instructions; skill use does not add approvals, CI jobs, mandatory subagents or live trading requirements.

## Review the actual diff

Infer the affected surface, platform and identities from the request and diff before asking for more information. Trace a suspected problem to its code path and observable consequence. Rows, selectors and local state may be the correct edit location; the owner map does not freeze the architecture.

Check only applicable contracts: order mode/precision, account identity, subscription lifecycle, cached versus live data, chart readiness, or provider-specific status. Relay `requestId` cases apply when that API exposes a request scope; otherwise check the active `fromTxId`. Unifold uses its recipient/session/execution lifecycle.

For performance findings, connect a hot write or broad subscription to the affected consumer and workload. A missing `memo`, an unpreferred style or an unrelated unrun scenario alone does not establish a defect.

## Report what was established

For changes to order submit/modify/cancel or withdrawal payload semantics, or signing behavior, an unverified changed contract is a correctness blocker. Identify the specific field/invariant and missing adapter/SDK or API evidence before marking it ready. Relevant source tracing and targeted payload/schema/mock-signing tests can supply that evidence; production trading, an additional approval step and unrelated platform runs are not required. This condition does not apply to presentation edits or refactors shown to preserve those contracts.

Summarize the changed behavior, relevant test/command results and runtime evidence. If a significant path could not be verified, identify the specific gap and why it matters. Distinguish a demonstrated correctness defect from missing evidence or an optional improvement; other evidence gaps are not automatically release blockers.

Preserve authorization and secret-handling boundaries from the main skill and repo instructions. Reuse authorization already provided; do not use production trading merely to satisfy a recipe.
