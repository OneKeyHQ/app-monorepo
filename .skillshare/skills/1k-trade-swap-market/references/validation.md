# Prove The Changed Trade Contract

Select the reported transition and the adjacent transitions affected by the
same owner. Do not run every provider and platform scenario for a small change.

## Find Focused Tests

Search beside the actual owner, including lowercase utilities and services:

```bash
rg --files packages/kit packages/kit-bg packages/shared | \
  rg -i '(swap|market|stock|bridge|limit|dustsweep).*(test|spec)\.'
yarn jest <focused-test-files> --runInBand
```

Add regression coverage where a wrong identity, merge, or execution transition
would escape existing tests. Follow `AGENTS.md` for commit/PR checks. If a change
crosses native runtime bundles, include the owning registration/startup-graph
checks; desktop rendering does not prove native bundle readiness.

## Match Evidence To The Change

| Changed contract | A useful adversarial check |
| --- | --- |
| Initialization | Delay configuration, edit the pair or amount, retry configuration, and compare first/settled frames. |
| Quote lifecycle | Race provider success/error, change an input, open/close a picker, and leave one of two active tickets. |
| Market entry | Compare the actual wide/compact and native/non-native routes that share the changed owner. |
| Review lifetime | Close during preparation, continue a confirmed execution, then reopen for another trade; results remain isolated. |
| Retry/fallback | Distinguish approval-only progress, business submission, uncertain broadcast, and user rejection; no submitted step is replayed. |
| Amount/fees | Compare Max/percentage amounts, same-asset extra costs, approval and payer changes, and sponsor validity at send. |
| Stock/cache | Change asset variant, account/address, network, or locale during refresh; retained display never becomes stale spend authority. |
| History | Restart after submission, disconnect/reconnect, merge hash-only updates, and exercise the channel's terminal/refund states. |
| Bulk execution | Cancel before and after submission, vary final payload value, and verify partial results and resumability under that flow's contract. |

## Report The Proof Boundary

Use the host that owns the issue: route, modal, extension popup/sidebar, or
native page/bottom sheet. Capture relevant selection, quote/request identity,
confirmed snapshot, build payload, execution result, persisted row, and terminal
state; a rendered element is not enough for those claims.

Separate static tracing, test results, actual UI interaction, and real
provider/signing/broadcast evidence. For layout-only work, first and settled
screens plus interaction evidence may be sufficient. State unavailable layers
instead of extending a utility test or screenshot into an end-to-end claim.
