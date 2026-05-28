# Review Checklist

Use this with `/1k-code-review-pr` for Trade/Swap/Market PRs.

## Context Checks

- Fetch the live PR head and compare against the intended base.
- Read PR body, linked Jira issues, latest Jira comments, and relevant Slack context when available.
- Check GitHub review threads with resolved/outdated state.
- Confirm commits and PR summary include relevant issue keys, or explain why none apply.
- PRs into `x` can use normal issue-based naming.
- PRs into release-version branches need neutral issue-based wording; cross-check `/1k-bundle-release` before publishing.

## Diff Checks

| Area | Questions |
| --- | --- |
| Source owner | Is the change made at the actual owner of the state, or only masking it in UI? |
| Snapshot | Does review/build/send use a frozen transaction snapshot where needed? |
| Async state | Can stale requests overwrite newer token, quote, account, provider, or preset choices? |
| Persistence | Are refresh, restart, modal reopen, tab switch, and account switch handled intentionally? |
| Provider | Are provider-specific fields preserved through quote/build/sign/history? |
| Fee | Are missing fee, real zero fee, display fee, estimate fee, and send-time fee distinct? |
| Network | Are EVM and non-EVM identities compared correctly? |
| Cross-surface entry | Do external DeFi/Earn/Market CTAs preserve token direction, source, mode, and native/wrapped identity? |
| Imports | Does the change respect OneKey import hierarchy? |
| Shared components | Is a shared primitive changed for a local business bug? Require strong justification. |

## Repeat-Risk Checks

- Market preset: UI, saved settings, review option, gas estimate params, and execution params agree.
- Quote progress: current event, manual provider, execution quote, and display list cannot drift.
- Token selector: Home, Send/Receive, and Swap have separate loading/data ownership where their request models differ.
- DeFi/Earn handoff: `Trade`, `Buy`, `Swap`, or `Wrap` CTAs land on a target surface that supports the exact native/wrapped token and mode.
- Recipient/incognito: account/network change does not preserve invalid stale address state.
- History: `rawStatus` and `finalStatus` are not accidentally merged.
- Provider: provider adapter fields survive signed rebuilds and history persistence.

## Score Caps

Do not give a strong pass if an in-scope review thread is untriaged, Jira/Slack/attachments were not checked, runtime-visible behavior lacks proof, provider units are guessed, or PR metadata no longer matches the diff.

## Output Shape

Lead with findings. Include severity, confidence, file/line, impact, and fix direction. Keep process blockers separate from code blockers; for release-version branches, separate code correctness, QA evidence, bundle/build evidence, and release gate state.
