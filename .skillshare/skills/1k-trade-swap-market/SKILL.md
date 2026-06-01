---
name: 1k-trade-swap-market
description: OneKey Trade/Swap/Market playbook for implementation, debugging, PR review, and validation. Always use when work touches Swap, Swap Pro, Market speed-swap, Private Send/incognito, DeFi/Earn funding handoffs into Trade/Swap/Limit, presets, limit orders, token selectors, providers, quotes, fees, slippage, history, pending status, Houdini, RocketX, LiFi, SWFT, Cow Limit, 交易, 兑换, 隐私发送, 限价, 预设, 报价, 手续费, 交易历史, or provider integration.
allowed-tools: Read, Grep, Glob, Bash
---

# Trade, Swap, Market

Use this for OneKey Trade/Swap/Market work where small state mistakes can break transaction behavior.

## First Principles

1. Treat Jira, Slack, Figma, and attachments as source inputs.
2. Separate interaction reuse from execution semantics.
3. Map selection -> quote -> review -> build -> sign/send -> history/status before editing.
4. Identify the value owner: server config, quote payload, build response, simpleDb, atom, local state, or provider adapter.
5. Verify on the surface that owns the regression.

## Quick Reference

| Topic | Guide | Start With |
| --- | --- | --- |
| Intake and source-of-truth | [intake-and-sources.md](references/rules/intake-and-sources.md) | Jira, Slack, Figma, attachments |
| Code map | [code-map.md](references/rules/code-map.md) | `ServiceSwap`, `quoteProgress`, `SwapPanelWrap`, `marketDirectSendTx` |
| Failure patterns | [failure-patterns.md](references/rules/failure-patterns.md) | preset, quote, token selector, fee, history, recipient state |
| Provider contracts | [provider-contracts.md](references/rules/provider-contracts.md) | provider field units, limits, rates, fees, status mapping |
| Review checklist | [review-checklist.md](references/rules/review-checklist.md) | live PR head, issue coverage, comments, diff, release metadata |
| Runtime validation | [validation-recipes.md](references/rules/validation-recipes.md) | network, desktop, iOS, provider failures |

## Default Workflow

1. Classify the surface: Swap, Swap Pro, Market speed-swap, Limit, Review/Confirm, History, token selector, or provider integration.
2. Read Jira and Slack when tools are available. If an attachment is not visible, open it with a desktop/browser tool or ask for the file.
3. Capture issue, platform, state owner, persistence, provider/network, runtime proof, and out-of-scope.
4. Search the code map before editing; prefer existing services, hooks, atoms, validators, and adapters.
5. Change the state owner, not a shared primitive, unless the issue targets that primitive.
6. Validate with a targeted command and runtime path for user-visible or transaction-state behavior.

## Output Defaults

- Implementation: report checked sources, state owner, touched files, validation, and runtime proof gaps.
- Review: lead with findings; separate process blockers from code blockers.

## Related Skills

- PR review: `/1k-code-review-pr`
- Analytics: `/1k-analytics`
- Jotai atoms: `/1k-state-management`
- Platform UI/simulator: `/1k-cross-platform`
- Release-version branches: `/1k-bundle-release`

## Hard Stops

- Do not approve or ship from diff cleanliness alone when Jira, Slack, Figma, or attachments were referenced but not checked.
- Do not treat missing provider fee/rate/estimate as real zero until the quote/build payload proves it.
- Do not reuse Home token-list state as proof for Send/Receive or Swap selectors.
- Do not collapse network/account/provider/token changes into one reset path without checking dependents.
- Do not claim runtime validation from a merely open desktop window; inspect the actual app path, network calls, or visible UI state.
