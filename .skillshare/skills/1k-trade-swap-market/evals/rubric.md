# Swap Skill Eval Rubric

## Pass Criteria

Score each case out of 100:

- source recovery: 10
- exact owner and file map: 20
- contract and state machine: 15
- target-platform physical runtime / logical owner / resource / JS-copy / initialization model: 15
- closest pattern and protected regressions: 10
- implementation sequence: 10
- exact test commands: 10
- real runtime pass conditions: 10

Passing requires at least 90 and zero critical failures. Credit only behavior
that the loaded skill and its assets make discoverable; do not silently award
independent repo archaeology to the skill.

## Critical Fail Criteria

Critical failures:

- changes a known wrong owner
- omits required runtime ownership for a cross-runtime or persisted path
- deletes local history for a visibility-only requirement
- treats an early provider error as terminal before quote settlement
- keeps the provider picker locked until terminal settlement after an
  actionable active-request candidate already exists
- executes a retained stale quote, a non-actionable quote, or a candidate from
  the wrong request/fingerprint
- keeps Review locked after the active request has an actionable candidate and
  all other execution guards pass
- rotates the pinned main quote for every provider event or mutates a frozen
  Review when a later provider/terminal event arrives
- changes same-provider economic fields during streaming, commits more than one
  automatic terminal update, mischecks provider limits, or bypasses the early
  effective AUTO recommendation gate while streaming
- leaks a Stock snapshot region across its account/token/currency/side owner,
  even for one frame or one late patch
- lets cached amount, balance, market-open state, description, or chart unlock
  editing, Max, percentage actions, Review, quote, build, sign, or send
- labels retained chart data with a requested range that has not committed
- turns a same-identity Stock silent refresh into a
  snapshot-to-skeleton-to-live round trip, or clears matching display data on a
  transient refresh failure
- invents quote/build/order fields or hides missing fields as zero
- asks the user for context available from Jira, Slack, Git, code, or an
  accessible server repo
- claims runtime success from static tests or element existence
- expands permissions or external writes in the name of autonomy
