# Intake And Source Inputs

Use this before implementation or review when Trade, Swap, Market, provider, or transaction state is involved.

## Source Order

1. Jira issue and latest comments.
2. Slack thread or channel discussion when linked or referenced.
3. Figma/design artifact for layout, warning copy, and interaction state.
4. GitHub PR body, live head commit, review threads, and CI.
5. Memory, branch names, and commits only as routing clues.

Issue-related requirements must be checked in Jira and Slack when the tools are available; PR text, branch names, and memory are not enough. If a source cannot be read in the current session, say that explicitly and keep the conclusion scoped.

## Required Intake Matrix

| Field | What To Capture |
| --- | --- |
| Issue | Jira key, title, status, owner, latest acceptance text |
| Source links | Jira, Slack, Figma, GitHub PR, QA thread, build/bundle thread |
| Surface | Swap, Swap Pro, Market Detail, Limit, History, token selector, provider panel |
| Platform | Desktop, iOS, Android, Web, Extension; include device if visual/runtime issue |
| Provider/network | Provider, chains, token type, EVM/non-EVM, BTC/UTXO if relevant |
| State owner | Server config, quote payload, build response, simpleDb, atom, component local state |
| Persistence | Which state persists across tab switch, account switch, refresh, restart, or modal reopen |
| Runtime proof | Network endpoint, UI click path, simulator/device, logs, or reason it was not run |

## Slack Search Keys

Search by more than Jira ID. Use combinations of:

- PR number and branch name.
- Provider name: `RocketX`, `Houdini`, `LiFi`, `SWFT`, `Cow Limit`, `1inch`.
- Domain terms: `Market preset`, `Swap Pro`, `token selector`, `provider fee`, `limit.max`, `Build Bundle Version`, `bundle-testing`.
- Common places: `client-end`, `qa-general`, `server`, `_all-issues`, `_doing`, `app-swap-dex`, and relevant DMs.

## Attachment Rule

Jira and Slack often contain blob images, videos, and CleanShot files. If only a placeholder or filename is visible, the evidence is unread. Open it with a desktop/browser tool or ask for the file.

## Requirement Boundary

For phrases like "align with Swap" or "same as Market":

- Write down whether this means visual interaction, review shell, quote behavior, build/sign/send behavior, history behavior, or all of them.
- If only the shell/interaction is shared, keep execution adapters separate.
- If the source inputs conflict, report the conflict before coding or approving.
