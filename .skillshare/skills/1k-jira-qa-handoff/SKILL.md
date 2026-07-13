---
name: 1k-jira-qa-handoff
description: Generates a Chinese product-behavior summary + test cases from git commits and syncs them to the PM's Jira task issue (update or create), preserving any existing Slack URLs and prior context. Use after the PM commits/PRs code. Triggers on "同步 Jira / 写到 Jira / 给 QA 写测试用例 / PM 交付 / jira QA handoff / 创建 Jira issue / 更新 Jira"; or when the user supplies a Jira URL with "总结改动" / "写测试用例".
---

# Jira QA Handoff

Convert recent git commits on the current branch into a **Chinese** product-behavior summary + test cases, then sync them to the PM's **task-type** Jira issue. Designed for **product managers** who have shipped code changes themselves.

**The team's flow**: the PR title carries the PM's task-type Jira key → after PR merge, Jira automatically generates a downstream test-type issue for QA → QA reads the PM's task description to get context. So the description written here is what QA will end up reading.

## Hard rules

- **Output language for Jira content: 中文 (Simplified Chinese)** — title, description, test cases. Never include code snippets, file paths, function names, line numbers, or implementation details. QA reads this; QA does not read code.
- **Skill instructions stay in English** (this file).
- **Preserve any pre-existing context in the Jira issue** when updating — Slack URLs, linked Jira issues, attached screenshots, @mentions, prior product decisions, and the existing title/description. **This is the silent default; never ask "should I preserve this?" and never list what you're "not changing" before posting.** Append, don't replace.
- **One confirmation gate, then execute.** Preview the proposed appended content once in Step 3. After the user approves, call the edit endpoint immediately — do not show a before/after diff, do not re-summarize what you're keeping.
- **Trust the diff, but ask for product intent.** Code shows what changed; only the PM knows why. If the intent is ambiguous, ask one clarifying question before drafting.
- Convert any relative dates ("today", "this week") to absolute dates (YYYY-MM-DD) before writing them into Jira.

## When to skip

- Pure refactor / chore / dependency bump with **no user-visible change** → tell the user "no QA-visible behavior to hand off" and stop.
- Code-only fixes that already have a QA-owned Jira test issue → confirm with the user before duplicating.

## Workflow

Copy this checklist into your reply at the start and tick items off as you go:

```
- [ ] Step 1: Determine commit range
- [ ] Step 2: Read commits and extract user-visible changes
- [ ] Step 3: Draft Chinese title + description (preview to user)
- [ ] Step 4: Sync to Jira (update existing OR create new)
- [ ] Step 5: Confirm result + return Jira URL
```

### Step 1: Determine commit range

Default: commits unique to the current branch vs `origin/x`. Same scope as `/1k-code-review-pr` — if it just ran in this session, reuse its diff output.

```bash
git fetch origin x
git log origin/x..HEAD --pretty=format:"%h %s" --no-merges
git diff origin/x...HEAD --stat
```

Other cases:
- User specifies a commit hash or range → use that exact range.
- User on `x` directly with uncommitted changes → use `git diff --staged` and `git diff` to capture the in-flight change; warn that nothing is committed yet.
- More than ~10 commits in the range → ask user whether to scope down (e.g., "only the last 3 commits", or "only commits touching `packages/kit/...`").

### Step 2: Extract user-visible changes

For each commit, read **the diff itself** (not just the message — messages lie or omit):

```bash
git show <hash> --stat
git show <hash> -- '<files of interest>'
```

For each change ask: **what does the user see or do differently?** Skip everything else.

| Code-level change | Becomes (in handoff) |
|---|---|
| Added new UI entry / button / page | New entry point + how to reach it |
| Changed copy / icon / layout | Visible change + before/after if known |
| Added analytics / logger call | "新增埋点" line in QA notes (no event-name code) |
| New i18n key | Confirm it renders in target locales |
| Refactor with same behavior | **Skip** — not QA-visible |
| Type / lint / build fix | **Skip** |
| Hidden flag / dev-only path | **Skip unless** PM says otherwise |

If you only find skip-category items, halt and report "no QA-visible behavior" instead of inventing test cases.

### Step 3: Draft Chinese title + description

Use the **Output Template** below. Show it to the user as a preview block in chat. Wait for approval or edits before any Jira write.

### Step 4: Sync to Jira

**Branch on whether the user gave a Jira issue URL.**

#### Path A — User gave a Jira issue URL

1. Parse the issue key from the URL (e.g., `https://onekeyhq.atlassian.net/browse/OK-53398` → `OK-53398`).
2. Authenticate Atlassian MCP if needed (see "Atlassian MCP notes" below).
3. Fetch the existing issue, then immediately call edit with: original title kept verbatim, description = original verbatim + appended block under `## 更新 YYYY-MM-DD — <brief>`. **Do not ask the user to re-confirm preservation, do not list "Title 不动 / Type 不动" decisions** — these are the silent default.
   - Only narrow exception (replace instead of append): existing description is **literally empty** (zero characters).
   - Only ask the user when (a) issue type ≠ task/任务, or (b) the appended content semantically conflicts with PM's existing acceptance criteria.

#### Path B — No Jira URL given

1. **First check recent commits and the PR title for an existing `OK-XXXXX` key** (`/1k-create-pr` injects one). If found → switch to Path A with that key, do not create a duplicate.
2. Authenticate Atlassian MCP if needed.
3. Identify the project key. Default for this repo: **`OK`** (verify against recent commits like `(OK-53398)` in messages). If unsure, ask.
4. Confirm issue type with the user. Default: **任务 / Task**. Ask before creating any other type (Bug / Story / Epic).
5. Create the issue, return the URL.

### Step 5: Confirm and return

Reply with the Jira URL + one-sentence summary (e.g., "已在 OK-53398 追加 1 个产品行为变更 + 2 个测试用例"); flag anything skipped.

## Output Template (Chinese — copy verbatim)

**Title format:**

```
[模块] 一句话功能描述
```

Examples (real OneKey style):
- `[接收] 新增「其他交易所」入口和点击埋点`
- `[发送] ERC-1155 NFT 信息卡新增 Max 按钮`
- `[硬件] 切换系统主题时底部导航栏颜色未跟随`

**Description format:**

```markdown
## 产品行为变更

1. **<功能点 1>** — 从用户视角的一句话描述（看到什么、能做什么、与之前的差异）
2. **<功能点 2>** — 同上
3. ...

## 测试用例

### 用例 1：<场景名>
**前置条件**：<账户类型 / 网络 / 数据状态等，没有就写「无」>
**测试步骤**：
1. ...
2. ...
3. ...
**预期结果**：
- ...
- ...
**涉及平台**：☐ Desktop ☐ iOS ☐ Android ☐ Web ☐ Extension（勾选适用项）

### 用例 2：<场景名>
（同上结构）

## 关联 PR / Commit

- PR: <URL，如有>
- Commits: <短 hash 列表，如 `a3394702d5`、`daf8d7551d`>

## 备注（可选）

- 已知限制 / 后续待办 / 与其他模块的依赖等。没有就删掉这一节。
```

**Test case rules**: 2–4 cases per change. Cover (1) golden path, (2) per-platform branches if behavior differs, (3) visible negative path (precondition unmet). Skip internal-only checks — QA can't observe analytics fields or state machines; if 埋点 verification is required, add a 备注 directing the PM to the data team for Mixpanel event `xxx`.

## Atlassian MCP notes

If unauthenticated, call `mcp__atlassian__authenticate` and follow its returned OAuth flow. After auth, the real Jira tools become deferred — load their schemas first:

```
ToolSearch(query="+atlassian jira", max_results=10)
```

Then call by fully-qualified names (`mcp__atlassian__<tool_name>`). Look for: get-issue-by-key, create-issue, update-issue, JQL-search.

**Cloud ID gotcha**: some Atlassian tools require a `cloudId`. If a call fails for that reason, find a `getAccessibleAtlassianResources`-like tool to fetch your sites and pick the matching one.

## Anti-patterns

- ❌ Quoting commit messages verbatim as the title (commit messages are dev-facing; titles need product framing).
- ❌ Writing test cases that read like unit tests ("verify clickExchangeEntry called with exchangeSource='others'") — QA can't observe internal calls.
- ❌ Listing every locale as a test case ("测试中文", "测试英文", ...) — say "抽样验证 zh_CN / ja_JP / es" instead.
- ❌ Auto-creating a Jira issue without asking project key + type.
- ❌ Overwriting an existing Jira description without showing the diff to the user.
- ❌ **Removing Slack thread URLs (or any prior links / @mentions / linked issues) from an existing Jira description when updating** — they are upstream context the PM intentionally placed there. Always append, never strip.
- ❌ **Asking "should I preserve your title/description?" or listing pre-write decisions like "Title 不动 / Type 不动 / Description 追加"** — preservation is the silent default; restating it adds noise. Only flag genuine conflicts (issue type mismatch, semantic conflict with existing acceptance criteria).

## Related skills

- `/1k-create-pr` — create the PR before / after this handoff (also injects `OK-XXXXX` into the PR title).
- `/1k-commit` — produce the underlying commits this skill summarizes.
- `/1k-git-workflow` — branch / commit conventions this skill assumes.
- `/1k-code-review-pr` — independent diff review; useful before handoff to catch behavior changes you might have missed.
