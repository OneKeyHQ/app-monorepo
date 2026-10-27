# Prove The Changed DeFi Contract

Choose checks for the changed behavior; this is not a checklist to run in full
for every task. Start with the reported transition and one adjacent path that
shares its owner.

## Find Focused Tests

Search beside the actual owner, including lowercase utilities and background
services:

```bash
rg --files packages/kit packages/kit-bg packages/shared | \
  rg -i '(earn|defi|borrow|staking).*(test|spec)\.'
yarn jest <focused-test-files> --runInBand
```

For an uncovered defect, add a test at the identity, merge, operation, or
settlement boundary that could make the proposed fix fail. Follow `AGENTS.md`
for commit/PR checks and the development skills for platform launch commands.

## Match Evidence To The Change

| Changed contract | A useful adversarial check |
| --- | --- |
| Account/product identity | Switch address derivation, account, network, or reserve while a request is pending; only the new scope may publish. |
| Portfolio merge | Compare targeted/full refresh, explicit zero, partial error, and omitted data; unrelated positions remain intact. |
| Approval/setup | Reopen after allowance changes; delay allowance after a successful receipt; separate setup completion from business success. |
| Confirmation lifetime | Transfer from modal to confirmation, cancel, and reopen for another action; old results must not mutate the new action. |
| Pending/replacement | Follow SpeedUp and Cancel through local pending and remote merge; operation locks and displayed action remain correct. |
| Settlement/refresh | Confirm without opening History; observe the matching position settle, including first deposit, exit-to-zero, and delayed indexing. |
| Funding return | Exercise success, failure, cancellation, and missing history; re-read balance before enabling the next step. |
| Layout/navigation | Use the real host, first and settled frames, loading sections, repeated entry, and back/modal behavior. |

## Report The Proof Boundary

For behavior involving transactions, capture the relevant request/build
payload, tx/order result, status source, and refreshed position on the owning
platform. Test data or static tracing can prove a branch or merge invariant;
they cannot prove real signing, provider settlement, or native interaction.
State which layers were exercised and which remain unverified.
