# Trivy pull request gate

The PR gate compares the exact event base against GitHub's corresponding test
merge. It verifies both ordered merge parents and runs the comparator from the
base checkout, never from the candidate tree. The candidate's tests run in a
separate job with read-only permissions. No `pull_request_target` is used.

## Policy

- Preserve HIGH/CRITICAL and `ignore-unfixed`, with development/test dependencies
  excluded as before. This is not a claim of complete dependency coverage.
- A different affected package version is a new finding, including replacement
  with another version affected by the same CVE. This conservative policy is
  deliberate; remediation that remains vulnerable requires review.
- Compare multisets, not totals or sets. Vulnerability identity includes target,
  ecosystem, package, installed version, advisory, package path and severity.
  Misconfiguration identity includes target, type, rule and resource (or affected
  source lines; truly file-level checks use the file identity).
- Secret identity uses a run-local HMAC of the original affected source lines,
  never the redacted `Match`. Moving identical lines preserves identity; adding
  a duplicate occurrence or changing a credential does not. Editing surrounding
  content on the same line may conservatively count as new. The random HMAC key
  is never persisted.
- Missing/malformed reports, unsupported schemas, invalid source ranges,
  scanner warnings/errors, missing Yarn inventories, lost surviving targets,
  mismatched revisions or mutable databases fail as **incomplete**, not passed.
  Unsupported inline `trivy:ignore` comments fail coverage validation as well.

## Reproducibility and isolation

Trivy is pinned to 0.70.0 and the setup action to a commit. A fresh private cache
is populated once from official GHCR vulnerability, Java and checks bundles.
Both scans disable all three bundle updates. Content digests are checked before
and after each scan; the binary and policy digests and complete revision tuple
are recorded in the evidence. Database download failures are fatal.

Both scans use identical explicit configuration, ignore and secret-config files
outside the source tree. `TRIVY_*` overrides and credentials are not forwarded.
Tracked Git blobs are exported rather than using `git archive`, so a candidate's
`export-ignore` attributes cannot hide findings. Submodules and escaping symbolic
links are rejected. Neither dependencies nor candidate scripts are executed.

Branch, schedule and manual SARIF publication is retained. PR results use the
incremental gate instead of GitHub's potentially ambiguous large-diff attribution.
This does not establish that PR12590's historical alerts were unchanged.

## Evidence

`trivy-pr-evidence-*` is retained for 14 days on success or failure. It contains
policy/revision/digest metadata, status, counts and sanitized findings with
location/rule metadata and HMAC identities. It never contains raw Trivy JSON,
SARIF, scanner logs, secret matches, code snippets, descriptions or titles.
The console/job summary prints only fixed diagnostics and counts. Raw reports
and the HMAC key live in a private temporary directory cleaned on normal exit;
runner disposal handles cancellation. A failed second scan retains the sanitized
first scan. A setup failure also uploads an explicit incomplete result.

## Rollout and limits

The introducing PR intentionally fails with `trusted_policy_not_installed`:
its base has no trusted comparator yet. It must not fall back to candidate code.
Review and explicitly resolve that bootstrap condition before adopting the gate.
Hotfix/release branches also need the reviewed policy before PR gating can work.
No branch protection or ruleset is changed by this patch.

Current baseline scans have Yarn git-URL protocol warnings. With this policy,
those scans fail as incomplete until parsing/coverage is repaired or a separately
reviewed, narrowly scoped policy is designed. An empty diff is not evidence of
complete coverage. This draft does not add an exception for those warnings.

As with any PR-defined workflow, a PR can propose changes to the YAML itself.
Trusted-base scripts prevent accidental/self-approved comparator changes but do
not replace repository enforcement of trusted workflows and security ownership.
No such administrative configuration is changed here.

Run the stdlib regression suite with:

```sh
python3 -I .github/scripts/trivy_gate_test.py
```

Use `actionlint .github/workflows/trivy.yml` to validate orchestration. Real-scanner
validation must use 0.70.0 and record the DB digest; today's DB cannot reproduce a
historical scan unless the original snapshot has also been retained.
