# Unsupported Scenarios

This file tracks benchmark scenarios that are currently not executable through the OneKey CLI and therefore must be handled as explicit no-op summaries instead of silent fallbacks.

| Story | Scenario | Skill | Status | Reason | Future potential |
|---|---|---|---|---|---|
| US-028 | `scenarios/core/limit-order.yaml` | `swap` | Unsupported in CLI today | OneKey CLI exposes `swap quote/build/execute/status/networks/history`, but it does not expose a spot limit-order placement command. The skill must preserve the limit-order parameters and decline without converting the request into an instant swap. | Re-evaluate if the CLI adds spot limit-order create/cancel/status commands. |
