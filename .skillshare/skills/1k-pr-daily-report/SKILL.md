---
name: 1k-pr-daily-report
description: Generate a 24-hour PR activity report grouped by module with Chinese summaries. Use when the user asks for PR statistics, daily report, PR summary, or mentions "PR 统计", "每日报告", "PR 汇总", "日报".
disable-model-invocation: true
---

# 24h PR 日报

Generate a PR activity report for the last 24 hours, grouped by module, with Chinese titles and status labels.

## Step 1: Fetch PR data

```bash
gh pr list --state all --search "created:>=$(date -v-24H +%Y-%m-%dT%H:%M:%S)" --limit 100 --json number,title,state,isDraft,mergedAt,createdAt,author,labels
```

On Linux, use `date -d '24 hours ago'` instead of `date -v-24H`.

## Step 2: Classify status

- **[已完成]**: state is MERGED
- **[进行中]**: state is OPEN (regardless of isDraft)

## Step 3: Classify modules

Determine the module from the PR title prefix and content:

| Module | Matching rules |
|--------|---------------|
| Desktop | title contains `desktop`, `electron`, `snap`, `serialport` |
| iOS | title contains `ios`, `TOCrop`, `EAS` |
| Market（行情） | title contains `market` |
| Perps（合约交易） | title contains `perps`, `trading` |
| 钱包/硬件 | title contains `wallet`, `account`, `keyless`, `pin`, `hardware` |
| CI/发布/热更新 | title contains `bundle`, `release`, `workflow`, `ci`, `label` |
| Watchlist（关注） | title contains `watchlist`, `watch` |
| Refer（推荐） | title contains `refer` |
| Network | title contains `network`, `netinfo` |
| 依赖/安全 | title contains `bump`, `upgrade`, `security`, `flatted`, `minimatch`, `dep` |

If a PR doesn't match any rule, place it under **其他**.

## Step 4: Output format

Use this exact format:

```
## 24h PR 统计

### {Module Name}
- #{number} {Chinese title} [{status}]
- #{number} {Chinese title} [{status}]

### {Module Name}
...

---

**合计 {total} 个 PR**：已完成 {merged} / 进行中 {open}
```

Rules:
- Translate each PR title to a concise Chinese summary
- Group by module, each module is a `###` heading
- Each PR is a `- #number title [status]` line
- Modules with more PRs come first
- End with a summary line showing totals
