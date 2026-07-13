# Autonomous Feature Workflow

Use this workflow when the request is to implement or repair a DeFi feature.
The expected result is an owner-correct, tested App change, not a list of files
for a human to finish.

## Definition Of Ready

Start implementation when the agent can recover:

- exact user behavior, entry surface, action, and completion state
- current client branch/base and actual PR/file scope
- latest Jira comments/attachments and relevant Slack corrections
- current portfolio, supported-action, build-transaction, order, and refresh
  contracts from the client and accessible server source
- closest current action/route/persistence pattern
- targeted tests and a real platform/runtime proof surface

Do not ask the user for repo, Jira, Slack, branch, or server information that
available tools can retrieve. Stop only for a real product choice, conflicting
authoritative sources, missing permission/secret/access, irreversible external
write, or unavailable runtime proof that materially changes the decision.

## Ordered Implementation Loop

1. Run
   `node .skillshare/skills/1k-defi-module-integration/scripts/check-readiness.mjs`.
   Resolve anchor drift before using the code map.
2. Freeze the source packet:
   - Jira description, latest comments, status, and attachments
   - Slack owner decisions, corrections, request/response examples, and QA state
   - client branch/base/HEAD, branch-only commits, and actual changed files
   - `server-service-earn` branch/ref/commit when supported protocols,
     build-transaction, actions, amount units, or order fields matter
   - a representative runtime payload when account/protocol-specific metadata
     decides visibility or execution
3. Fill [feature-packet.md](../templates/feature-packet.md). Separate facts,
   hypotheses, and unresolved conflicts.
4. Classify ownership before UI work:
   - App-owned action, Earn/Borrow/Staking flow, Discovery handoff, or Swap handoff
   - `main` route/UI/form/confirm state
   - `bg` service/order/refresh/SimpleDB state
   - persistent native/web resource and serialized copies
5. Freeze the operation sequence: load -> validate -> approval/permit/setup ->
   business build -> signature confirm -> broadcast -> attach `orderId` ->
   settle -> immediate/delayed refresh -> history/visible state.
6. Find the closest current pattern with `rg` and `git log`. Inspect the actual
   PR file list; a title can hide adjacent DeFi, Borrow, Stock, or chart changes.
7. Implement the smallest owner-correct change. Keep native modal-route and
   extension/desktop dialog hosts separate while sharing typed business content.
8. Add focused tests for every resolver, lifecycle terminal, account/network
   owner guard, persistence mutation, and refresh schedule touched.
9. Run [test-map.md](test-map.md), then
   `yarn agent:check --profile commit` before commit.
10. Exercise the owning route/platform using
    [runtime-boundaries.md](runtime-boundaries.md). Static tests do not prove
    signing, modal host behavior, event delivery, persistence, or restart.
11. Re-read the diff against the feature packet and protected protocols before
    delivery.

## Fast Owner Routes

### AssetDetails Lending Action

Trace `DeFiProtocolDetails` -> `ProtocolPositionActionButton` -> lazy
`ProtocolLendingActionDialog` -> shared content -> Borrow approval/withdraw/
repay hooks -> signature confirm -> order settlement -> `ServiceDeFi` refresh.
Native uses the `DeFiProtocolAction` modal route/page host; extension/desktop
can use the in-page dialog.

### Portfolio Action Or Missing Button

Resolve the position payload, grouped source metadata, outer position category,
inner asset category, `/supported-protocols`, and `/build-transaction`
requirements separately. Do not hide a position because it has no action.

### External Protocol DApp

If the App only opens a website and the website has not requested a chain RPC,
the owner is Discovery/browser handoff. Do not invent an internal DeFi modal,
pending row, or `ServiceDeFi` transaction flow.

### All Networks Or Refresh/Persistence

Trace `DeFiListBlock` owner keys and request guards in `main`, then
`ServiceDeFi` force refresh/event delivery and `SimpleDbEntityDeFi` in `bg`.
Prove account/network identity, immediate plus delayed refresh, restart
hydration, and stale A -> B response rejection.

## Completion Contract

Ready means the packet records:

- current sources and resolved conflicts
- exact owner files and five-part runtime model
- typed operation/route/order/refresh contract
- implementation and protected protocol/platform regressions
- exact tests run and results
- real route/platform/runtime evidence and explicit pass/fail
- only genuine remaining authority or unavailable-runtime gates

Do not label source orientation, a plan, or documentation validation as feature
completion.
