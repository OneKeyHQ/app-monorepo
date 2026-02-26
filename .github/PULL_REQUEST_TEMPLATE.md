## What

<!-- Brief description of what this PR does. 1-2 sentences. -->

## Why

<!-- Motivation: bug report link, feature request, tech debt, etc. -->

Closes #<!-- issue number -->

## How

<!-- High-level approach. Mention key design decisions and tradeoffs. -->

## Changes

<!-- List the specific changes made in this PR. -->

- [ ] Change 1
- [ ] Change 2

## Platform Impact

<!-- Check all platforms affected by this change. -->

- [ ] iOS
- [ ] Android
- [ ] Desktop (macOS/Windows/Linux)
- [ ] Web
- [ ] Browser Extension
- [ ] None (shared/infra only)

## Risk Level

<!-- Choose one. If High/Critical, explain why in the "Risks" section below. -->

- [ ] Low — Config/docs/style/type-only changes
- [ ] Medium — Normal feature or bugfix
- [ ] High — Auth/crypto/signing/dependency changes
- [ ] Critical — Core security, key management, transaction flow

## Testing

<!-- Describe how you tested this change. Include evidence (screenshots, logs, screen recordings). -->

**Automated tests:**
- [ ] New tests added
- [ ] Existing tests updated
- [ ] Tests pass: `yarn test -- --testPathPattern=<path>`

**Manual testing:**
- [ ] Tested on affected platform(s)
- [ ] Edge cases verified (empty state, error state, loading state)

<details>
<summary>Screenshots / Recordings</summary>

<!-- Paste screenshots or link to recordings here -->

</details>

## Self-check

<!-- Run through these before requesting review. -->

- [ ] No sensitive data in logs (mnemonics, private keys, API keys, PII)
- [ ] Import hierarchy respected (shared → components → core → kit-bg → kit → apps)
- [ ] `yarn lint:staged` passes
- [ ] `yarn tsc:staged` passes
- [ ] No dead code or untracked TODOs left behind

## Risks

<!-- What could go wrong? What should reviewers pay extra attention to? Leave blank if Low risk. -->
