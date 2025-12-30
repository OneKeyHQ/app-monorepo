# Generate PR Report

Generate a PR report for a specified user within a given time range, formatted for Slack.

## Arguments

- `$ARGUMENTS`: `<username> <time_range>`
  - `username`: GitHub username (e.g., `limichange`)
  - `time_range`: Time range in hours (e.g., `24h`, `48h`, `72h`). Default: `48h`

## Workflow Steps

1. **Parse arguments**
   - Extract username from arguments
   - Extract time range (default to 48h if not specified)
   - Calculate the UTC timestamp for the time range

2. **Fetch PR list**
   - Use `gh pr list --author <username> --state all --json number,title,state,createdAt,url,isDraft,mergedAt --limit 50`
   - Filter PRs created within the specified time range
   - Exclude draft PRs (`isDraft: true`)

3. **Fetch PR descriptions**
   - For each non-draft PR, fetch the body using `gh pr view <number> --json body`
   - Extract key information from CodeRabbit summary or PR description

4. **Categorize by module**
   - Analyze PR titles and descriptions
   - Group PRs by major modules (e.g., Market, WebDapp, Swap, Discovery, etc.)
   - Use "通用组件" for general/shared components

5. **Generate Slack-friendly report**
   - Use plain text format (no Markdown links)
   - Use `———` for section dividers
   - Format:
     ```
     <username> 过去 <time_range> PR 汇报

     统计时间范围：<start_time> UTC ~ <end_time> UTC

     ———

     创建的非草稿 PR（共 N 个）

     #1234 fix: description ✅
     #1235 feat: description ✅
     ...

     ———

     按模块分类详情

     ModuleName1
     Description in Chinese #1234
     Description in Chinese #1235

     ModuleName2
     Description in Chinese #1236
     ```

6. **Save report to file**
   - Create `.tmp/` directory if not exists
   - Save report to `.tmp/pr-report-<username>-<date>.md`
   - Date format: `YYYY-MM-DD`
   - Example: `.tmp/pr-report-limichange-2025-12-29.md`

7. **Output the report**
   - Display the report content in the terminal
   - Inform user of the saved file path

## Output Format Rules

- No bullet points (`-`, `•`)
- No Markdown formatting (`*`, `**`, `[]()`)
- PR status: ✅ for Merged, 🔄 for Open
- Module names as plain text headers
- Descriptions translated to Chinese
- PR number at the end of each description line

## Example Usage

```
/pr-report limichange 48h
/pr-report limichange 24h
/pr-report limichange
```

## Example Output

```
limichange 过去 48 小时 PR 汇报

统计时间范围：2025-12-27 02:12 UTC ~ 2025-12-29 02:12 UTC

———

创建的非草稿 PR（共 12 个）

#9518 fix: lower window height threshold for market recommend list title ✅
#9516 fix: clear token detail state before opening swap pro market detail ✅

———

按模块分类详情

Market
降低推荐列表标题显示的窗口高度阈值 (800px → 700px) #9518
从 SwapPro 导航到行情详情前清除过期 Token 数据 #9516

WebDapp
添加硬件钱包不可用警告提示，自动切换到可用钱包 #9493

通用组件
移除 ConnectionIndicatorFooter 中 Web 端专用的渐变图片和动画 #9495
```

Report saved to: .tmp/pr-report-limichange-2025-12-29.md
