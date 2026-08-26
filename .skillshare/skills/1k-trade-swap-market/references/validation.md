# Trade / Swap Validation

## Focused Checks

Discover tests beside the changed owner instead of relying on a frozen list:

```bash
rg --files packages/kit packages/kit-bg packages/shared | \
  rg '(Swap|Market|Stock|Bridge|Limit).*(test|spec)\.'
yarn jest <focused-test-files> --runInBand
```

Add a focused test when the changed identity resolver, stale-result guard,
quote selection, frozen review, history merge, or persistence transition is
not covered. Before committing product code, run:

```bash
yarn agent:check --profile commit
```

## Runtime Proof By Failure Class

- Quote/provider: change amount, token, network, or provider while requests are
  in flight; prove only the current actionable quote wins.
- Cross-network request: prove distinct signer/receiver in both directions,
  omit absent optional params, and preserve identity through build.
- Review/build: enter review, change outer page state, and prove the confirmed
  snapshot and build payload remain frozen and consistent.
- Review rebuild: delay build and fee independently; prove UI and Confirm follow
  the intended phase, focus loss preserves active work, and stale work cannot publish.
- Handoff: start from the real source entry, record its one-shot params, then
  prove Swap owns settled selection and execution after mount.
- Cold start/flicker: capture first meaningful and settled frames, including
  visible tab, internal type, selected assets, icons, readiness, and quote.
- History/status: capture submit result, persisted identity, pending row,
  status source, terminal state, and detail display.
- Disconnect/restart: distinguish hidden UI from retained persisted rows; on
  reconnect, the same identities must return and repair may resume.
- New channel: prove happy path, one provider failure/stale response, one
  terminal status, and restart/replay behavior.
- Multi-network positions: include delayed and failed requests; prove successful
  rows are actionable, owner keys agree, and partials are not persisted complete.
- Startup graph: compare the final Native main/background report with its budget;
  do not raise the threshold or infer success from one missing module.

## Platform Proof

Use the platform and host that own the bug: desktop/web route or modal,
extension popup/sidebar, or native page/dialog/bottom sheet. For native or
extension cross-runtime paths, inspect the relevant main state, serialized
service payload, background result, and persisted row. For desktop/web, treat
the App as single-runtime while preserving service ownership.

A settled screenshot, rendered element, or passing utility test is not enough
when the bug concerns first-frame state, quote identity, build/send, pending,
persistence, or status repair. Report checks actually run and unavailable
runtime or provider evidence.
