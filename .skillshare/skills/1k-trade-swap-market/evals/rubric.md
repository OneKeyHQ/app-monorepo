# Trade / Swap / Market Eval Rubric

## Pass Criteria

- Trace the owning transition and freeze full trade/request identity.
- Keep source signer and target receiver distinct across every execution stage.
- Omit absent optional fields and preserve valid provider/filter intent when
  narrowing a fallback.
- Separate executable review readiness, fee readiness, and Confirm authority.
- Publish authoritative multi-network results incrementally under canonical
  owner keys; do not persist partial runtime state as a complete snapshot.
- Validate the real platform/payload and the final startup artifact when the
  change affects Native startup dependencies.

## Critical Fail Criteria

- Reuses the source address as a cross-network receiver or sends invalid empty
  optional params.
- Bypasses a provider/compliance filter globally without evidence.
- Enables Confirm from a build response while required execution fields are
  unready, or accepts stale rebuild results.
- Treats cached/partial position data as current actionable truth, blocks all
  networks on one tail request, or uses locale-dependent owner identity.
- Raises a startup budget or claims artifact success from a static diff alone.
