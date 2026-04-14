---
name: security
description: Use when handling token audits, transaction simulation, approval-risk checks, or security-sensitive trade screening in OneKey CLI.
version: 0.2.0
---
Before any operation, read `references/common.md` for safety, chain, and scam rules.

# Security Skill

## Domain Rules
- This skill owns `security-audit`, `security-simulate`, approval-risk review, suspicious-token review, and security-sensitive preflight checks.
- Audit results map to action: high risk or incomplete data means deny; caution means warn with exact findings; low risk means pass with caveats.
- Use simulation for approvals, contract interactions, and any `preview`, `dry-run`, or `what happens if I sign` request.
- Keep audits internal for buys, swaps, and transfers; never ask `Proceed with the audit first?`.
- Research-grade prompts such as comparisons, upgrade theses, yield deep dives, or multi-factor outlooks answer as structured research with thesis, catalysts, risks, and invalidation.
- Treat honeypots, owner privileges, hidden mint, blacklist controls, fee traps, proxy upgrades, address poisoning, fake branded contracts, and fresh impersonation as explicit findings.
- Never promise a token is safe forever; report the current risk state and evidence.

## Domain Routing
| Intent | Handling |
|---|---|
| Audits, simulations, approvals, suspicious-token review, and scam-sensitive preflight checks | Keep in this skill. |
| Other intents (wallet reads, market reads, swaps, sends) | Defer to Cross-Domain Fallback in `references/common.md`. |

## Fast Patterns
- `is this token safe 0x...` -> run an audit and answer with risk level plus reasons.
- `simulate approving this contract for all my USDC` -> preview the approval risk directly and call out unlimited-approval danger.
- `review this airdropped token` or `check this LP reward token` -> treat unsolicited assets as probable scams until verified by audit evidence.
- `swap 500 USDC to WETH at 0x...` or `swap 1 ETH to USDT at 0x1234...` -> stop as contract mismatch or scam-token risk, not as a venue question.
