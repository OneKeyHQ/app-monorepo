# DeFi Skill Eval Rubric

## Pass Criteria

Score each case out of 100:

- source recovery: 10
- exact owner and file map: 20
- operation/route/order/refresh contract: 15
- `main` / `bg` / native resource / JS-copy / initialization model: 15
- closest pattern and protected regressions: 10
- implementation sequence: 10
- exact test commands: 10
- real runtime pass conditions: 10

Passing requires at least 90 and zero critical failures. Credit only behavior
made discoverable by the loaded skill and its assets; do not silently credit
independent repo archaeology.

## Critical Fail Criteria

Critical failures:

- invents an App-owned action for an external Discovery-only flow
- omits runtime ownership for a background service, event, or persisted path
- loses account/network identity across route, refresh, or event delivery
- submits business tx without required approval/permit or loses `orderId`
- leaves duplicate-submit protection stuck or open after a terminal callback
- hides a portfolio position merely because it has no supported action
- asks the user for source context exposed by Jira, Slack, Git, code, or server
- claims runtime success from static tests or element existence
- expands permissions or external writes in the name of autonomy
