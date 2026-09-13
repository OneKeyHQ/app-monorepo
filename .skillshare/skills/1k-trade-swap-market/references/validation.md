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
- Review/build: enter review, change outer page state, and prove the confirmed
  snapshot and build payload remain frozen and consistent.
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
- Embedded Market/Stock: from the real Market detail entry, switch to another
  stock variant and network while the ticket is mounted; prove the shared Swap
  ticket keeps the input/review lifecycle, the old pay token cannot leak, and
  the new quote belongs to the new identity. Also exercise config unavailable,
  terminal unsupported, and full-Swap fallback paths separately.
- Native percentage input: with a native pay token and a gas reserve, verify
  25/50/100% use the same available-balance semantics as Max, not a second
  reserve subtraction.
- Terminal order/history states: verify success, failure, cancel, expiry, and
  refund/source/replacement IDs stop polling and render the correct detail
  rows without duplicating a transaction ID; verify only a balance-changing
  refund transition triggers balance refresh.

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

For a new shared Market/Swap module on native, update and check the module-ID
registry and run the owning Union Build/startup-graph checks. A registry diff or
desktop-only render is not proof that the split main/background bundles load.
