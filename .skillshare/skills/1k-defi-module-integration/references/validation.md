# Earn / DeFi Validation

## Focused Checks

Find tests beside the changed owner; do not rely on a frozen test list:

```bash
rg --files packages/kit packages/kit-bg packages/shared | \
  rg '(Earn|DeFi|Borrow|Staking).*(test|spec)\.'
yarn jest <focused-test-files> --runInBand
```

Add a focused test when the changed identity resolver, setup/business
sequence, terminal callback, stale-result guard, or persistence transition is
not covered. Before committing product code, run:

```bash
yarn agent:check --profile commit
```

## Runtime Proof

Choose the real source entry and affected platform. Capture the layers that
matter to the change:

- route params and account/network/provider identity
- current position, supported action, and build payload
- setup and business confirmation sequence
- tx/order result, terminal status, pending/history state
- refresh event/request and final visible position
- restart or account-switch result when persistence/staleness is involved

For native route or layout work, validate the Discovery host and real modal or
bottom sheet. For extension/desktop/web, validate their actual dialog/route
host. Element existence and a successful build response are not end-to-end
proof.

## Minimum Regression Set

- the reported entry/action on its owning platform
- one sibling action or protocol sharing the changed owner
- cancel/failure or missing-data behavior
- account/network change while a request is in flight, when applicable
- refresh/pending/history agreement after success

Report checks actually run and any unavailable runtime or service evidence.
