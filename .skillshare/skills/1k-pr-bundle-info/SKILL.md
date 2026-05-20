---
name: 1k-pr-bundle-info
description: Posts a formatted Bundle Release Info comment on a GitHub PR. Given a PR (URL or number), fetches the latest release-app-bundles workflow run, extracts BUILD_NUMBER / BUILD_BUNDLE_VERSION / BUILD_SOURCE / BRANCH / COMMIT from the prepare-params job logs, derives the Jira key (OK-XXXXX) from the PR title, and posts or updates a single comment with PR / Bundle / build params / JIRA links. Triggers on "bundle 信息留言", "PR 贴 bundle 信息", "post bundle info", "在 PR 上留言 bundle".
allowed-tools: Bash, Read
---

# PR Bundle Info Comment

Posts a formatted **Bundle Release Info** comment on a bundle-release PR. Reads from GitHub Actions, writes back to the PR. Idempotent — re-running on the same PR updates the existing comment instead of creating a duplicate.

## When to use

After a `release-app-bundles` workflow has finished for a PR, and you want QA / reviewers to see a single canonical block with:

- PR link
- Workflow run link
- `BUILD_NUMBER`, `BUILD_BUNDLE_VERSION`, `BUILD_SOURCE`, `BRANCH`, `COMMIT`
- Jira link (derived from PR title)

Not a release flow step — a standalone utility. Works on any PR, on any base branch, as long as a `release-app-bundles` run exists for the PR's head branch.

## Input

Accept either form from the user:

- A PR URL: `https://github.com/OneKeyHQ/app-monorepo/pull/11725`
- A PR number alone: `11725`

If nothing is supplied, ask the user.

```bash
REPO="OneKeyHQ/app-monorepo"
PR_NUMBER="<parsed from input>"
```

## Step 1: Fetch PR metadata

```bash
gh pr view "$PR_NUMBER" --repo "$REPO" \
  --json number,title,headRefName,headRefOid,url
```

Capture:

- `title` → used to extract the Jira key
- `headRefName` → used to find the workflow run (the branch name)
- `headRefOid` → the current PR head commit. Save as `PR_HEAD_SHA`.
- `url` → used in the comment

If the PR cannot be fetched, stop with a clear message.

## Step 2: Find the release-app-bundles workflow run

List recent workflow runs for the PR branch and pick the latest successful `release-app-bundles` run:

```bash
gh run list --repo "$REPO" \
  --branch "$HEAD_BRANCH" \
  --workflow release-app-bundles \
  --limit 10 \
  --json databaseId,headSha,status,conclusion,url,createdAt
```

Selection rule:

- Prefer the most recent run with `conclusion=success` **and** `headSha="$PR_HEAD_SHA"`.
- If no successful run matches the current PR head, use the most recent run with `headSha="$PR_HEAD_SHA"` and wait for it to finish.
- If no run matches the current PR head at all → trigger one (see Step 2a), then re-list after it completes.
- Never post bundle info from a run whose `headSha` is different from the current `PR_HEAD_SHA`. A branch may have older successful runs after new commits are pushed.

Save:

- `RUN_ID` (the `databaseId`)
- `RUN_URL` = `https://github.com/<repo>/actions/runs/<RUN_ID>`

## Step 2a: Trigger a release-app-bundles run (when no current-head run exists)

When Step 2 finds no run for `$HEAD_BRANCH` at `PR_HEAD_SHA`, present both options to the user — manual UI or CLI — and emphasize that **the workflow must be triggered against the PR's head branch**, not `x` or any release branch. A mismatch produces a bundle for the wrong code.

**Manual UI**

> No `release-app-bundles` run found for `$HEAD_BRANCH`. Trigger one here:
> https://github.com/OneKeyHQ/app-monorepo/actions/workflows/release-app-bundles.yml
> → click **Run workflow**, set **Use workflow from branch** = `$HEAD_BRANCH`, then run.

**CLI (offer to run it for the user)**

```bash
gh workflow run release-app-bundles.yml \
  --repo "$REPO" \
  --ref "$HEAD_BRANCH"
```

Ask before executing — triggering a build is a shared-state action.

After triggering, the full run takes ~25–30 minutes — **but we don't wait for the full run**. The `prepare-params` job emits all required build params and finishes in ~10-30 seconds. Wait only for that job, then proceed.

```bash
# Give GitHub a moment to register the run
sleep 5
NEW_RUN_ID=$(gh run list --repo "$REPO" --branch "$HEAD_BRANCH" \
  --workflow release-app-bundles --limit 1 --json databaseId --jq '.[0].databaseId')

# Poll until prepare-params completes (typically <30s)
while :; do
  STATE=$(gh run view "$NEW_RUN_ID" --repo "$REPO" --json jobs \
    --jq '.jobs[] | select(.name=="prepare-params") | .status + ":" + (.conclusion // "")')
  case "$STATE" in
    completed:success) break ;;
    completed:*) echo "prepare-params failed: $STATE"; exit 1 ;;
    *) sleep 5 ;;
  esac
done

RUN_ID="$NEW_RUN_ID"
```

Then continue to Step 3. The rest of the run (web/desktop/native bundles) keeps running in the background — Step 3's log fetch works on a single job even when the overall run is still `in_progress`.

## Step 3: Extract build parameters from prepare-params logs

Find the `prepare-params` job and read its logs **via the per-job API** (not `gh run view --log`, which refuses while the overall run is `in_progress`):

```bash
PREPARE_JOB_ID=$(gh run view "$RUN_ID" --repo "$REPO" --json jobs \
  --jq '.jobs[] | select(.name=="prepare-params") | .databaseId')

gh api "/repos/${REPO}/actions/jobs/${PREPARE_JOB_ID}/logs" 2>&1 \
  | grep -E "  BUILD_NUMBER=|  BUILD_BUNDLE_VERSION=|  BUILD_SOURCE=|  BRANCH=|  COMMIT="
```

> Why per-job API: `gh run view --log` errors with `"run … is still in progress; logs will be available when it is complete"` until **every** job finishes. `gh api /repos/{repo}/actions/jobs/{id}/logs` returns a single job's logs as soon as that job completes, so we can post bundle info ~30 sec after triggering instead of waiting 25-30 min for native builds.

The `Generate build parameters` step emits five summary lines (each indented by two spaces) at the end:

```
  BUILD_NUMBER=2026051841
  BUILD_BUNDLE_VERSION=12018459
  BUILD_SOURCE=bundle-release
  BRANCH=fix/mobile-tab-list-restore-from-storage-v6.3.0
  COMMIT=0dfc436d033204740456ffbcf46425cde491d256
```

Parse into shell variables: `BUILD_NUMBER`, `BUILD_BUNDLE_VERSION`, `BUILD_SOURCE`, `BRANCH`, `COMMIT`.

If any are missing (logs trimmed, step renamed, etc.), stop and tell the user which one could not be parsed.

Verify `COMMIT` matches the current PR head before posting:

```bash
if [ "$COMMIT" != "$PR_HEAD_SHA" ]; then
  echo "Bundle run commit $COMMIT does not match current PR head $PR_HEAD_SHA. Trigger or wait for a fresh release-app-bundles run."
  exit 1
fi
```

## Step 4: Derive Jira key(s)

Extract **all** `OK-<digits>` tokens from the PR title (a single PR often covers multiple issues):

```bash
JIRA_KEYS=$(printf '%s' "$PR_TITLE" | grep -oE 'OK-[0-9]+' | awk '!seen[$0]++')
```

- 0 keys → omit the `JIRA:` line entirely
- 1 key → `JIRA: [OK-XXXXX](https://onekeyhq.atlassian.net/browse/OK-XXXXX)`
- 2+ keys → comma-separate, each as its own link:
  `JIRA: [OK-AAAAA](https://…/OK-AAAAA), [OK-BBBBB](https://…/OK-BBBBB)`

Preserve title order; deduplicate.

## Step 5: Build the comment body

Use exactly this format. Short commit = first 7 chars of `COMMIT`.

```
PR: [#<PR_NUMBER>](<PR_URL>)
Bundle: [actions/runs/<RUN_ID>](<RUN_URL>)
Build Number: `<BUILD_NUMBER>`
Build Bundle Version: `<BUILD_BUNDLE_VERSION>`
Build Source: `<BUILD_SOURCE>`
Branch: `<BRANCH>`
Commit: [<COMMIT_SHORT>](https://github.com/<repo>/commit/<COMMIT>)
JIRA: [<JIRA_KEY_1>](<JIRA_URL_1>), [<JIRA_KEY_2>](<JIRA_URL_2>)
```

Formatting rules:

- Labels: Title Case with spaces (`Build Number`, not `BUILD_NUMBER`).
- URL values → wrap as `[short display](url)`.
- Non-URL values → wrap in backticks (`` `value` ``).
- `Commit` links the full SHA but displays the 7-char short SHA.
- `JIRA`: one line, comma-separated `[KEY](url)` per key. Omit the entire line if no key was found.

## Step 6: Post or update the comment

Look for an existing Bundle Release Info comment on the PR (heuristic: a comment whose body starts with `PR: [#<PR_NUMBER>](`):

```bash
EXISTING=$(gh api "/repos/${REPO}/issues/${PR_NUMBER}/comments" \
  --jq ".[] | select(.body | startswith(\"PR: [#${PR_NUMBER}](\")) | .id" \
  | head -1)
```

- If `EXISTING` is empty → create:

  ```bash
  gh pr comment "$PR_NUMBER" --repo "$REPO" --body "$BODY"
  ```

- If `EXISTING` is set → update in place:

  ```bash
  gh api -X PATCH "/repos/${REPO}/issues/comments/${EXISTING}" \
    -f body="$BODY" --jq '.html_url'
  ```

Confirm with the user before overwriting if the existing content differs significantly.

## Step 7: Output

Print the comment URL returned by GitHub:

```
Posted: https://github.com/OneKeyHQ/app-monorepo/pull/11725#issuecomment-4494147672
```

## Worked example

Input: `https://github.com/OneKeyHQ/app-monorepo/pull/11725`

Output comment body:

```
PR: [#11725](https://github.com/OneKeyHQ/app-monorepo/pull/11725)
Bundle: [actions/runs/26137511056](https://github.com/OneKeyHQ/app-monorepo/actions/runs/26137511056)
Build Number: `2026051841`
Build Bundle Version: `12018459`
Build Source: `bundle-release`
Branch: `fix/mobile-tab-list-restore-from-storage-v6.3.0`
Commit: [0dfc436](https://github.com/OneKeyHQ/app-monorepo/commit/0dfc436d033204740456ffbcf46425cde491d256)
JIRA: [OK-54651](https://onekeyhq.atlassian.net/browse/OK-54651)
```

## Related Skills

- `/1k-bundle-release` — Multi-step bundle release flow (checkout, prepare, pr, diff-check, audit, publish, sync)
