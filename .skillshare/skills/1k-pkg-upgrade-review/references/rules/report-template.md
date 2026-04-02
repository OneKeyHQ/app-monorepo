# Report Template

Use this template when generating package upgrade review reports.

## File Naming

```
node_modules/.cache/pkg-upgrade/<package-name>-<old-version>-to-<new-version>.md
```

Examples:
- `@isaacs-brace-expansion-5.0.0-to-5.0.1.md`
- `minimatch-9.0.3-to-10.0.0.md`
- `react-native-reanimated-3.8.0-to-3.9.1.md`

Use `-` to replace `/` and `@` scope separators in package names.

## Template

````markdown
# <PACKAGE_NAME> <OLD_VERSION> -> <NEW_VERSION> 升级分析

> PR: <PR_URL>
> 生成时间: <DATE>

---

## 一、代码差异

### 1.1 新增导出

```javascript
// List new exports (constants, functions, types)
```

### 1.2 移除导出

```javascript
// List removed exports (if any) - HIGH RISK
```

### 1.3 函数签名变更

```diff
- // Old signature
+ // New signature
```

Explain what changed: new params, removed params, type changes.

### 1.4 核心逻辑变更

Describe behavioral changes with diff snippets for each change point.

```diff
- // Old behavior
+ // New behavior
```

### 1.5 完整 diff

Include the full diff of the main source file(s) for reference.

```diff
// Full diff output
```

### 1.6 其他变更

| 文件 | 变更 |
|------|------|
| `package.json` | Description of metadata changes |
| `README.md` | Description of doc changes |

### 1.7 安全意义

Describe any security implications (CVE fixes, DoS prevention, input validation, etc.).

---

## 二、项目中的调用位置

### 2.1 项目源码

State whether direct imports exist. If yes, list each file and line with the relevant code.

### 2.2 node_modules 中的间接调用方

For each caller found in node_modules:

#### 调用方 N: <CALLER_PACKAGE>

- **文件**: `node_modules/<path>:<line>`
- **<CALLER> 版本**: X.Y.Z
- **依赖声明**: `"PACKAGE": "^X.Y.Z"`

```javascript
// The actual call site code
```

**用途**: What this caller uses the package for.

### 2.3 调用方式汇总

| 调用方 | 调用代码 | 参数数量 | 是否使用新增 API |
|--------|----------|----------|------------------|
| caller1 | `expand(pattern)` | 1 | 否 |

### 2.4 安装位置

| 位置 | 版本 | 说明 |
|------|------|------|
| 根 `node_modules/PACKAGE` | X.Y.Z | hoisted / nested |
| `apps/desktop/app/node_modules/` | X.Y.Z or N/A | 说明 |

---

## 三、兼容性评估

| 变更项 | <OLD_VERSION> | <NEW_VERSION> | 兼容性 |
|--------|---------------|---------------|--------|
| 函数签名 | `fn(a)` | `fn(a, b?)` | 完全兼容 / 需要修改 |
| 返回值类型 | `string[]` | `string[]` | 无变化 / 变更 |
| 返回值内容 | 描述 | 描述 | 无影响 / 需评估 |
| 新增导出 | 无 | `CONST_NAME` | 不影响现有代码 |
| 移除导出 | `oldFn` | 无 | 破坏性变更 |

### 返回值截断/变更风险

Describe any scenarios where return value changes could affect callers.

**结论: [此升级安全/存在风险]，[建议合并/需要修改后合并/建议拒绝]。**
````

## Risk Level Guidelines

Use these criteria to determine the conclusion:

### Safe to merge (建议合并)
- Patch version bump
- Only new optional parameters added
- Return type unchanged
- No direct usage in project source
- All indirect callers compatible

### Merge with changes (需要修改后合并)
- Minor version bump with new features used by callers
- Return content changed but callers can handle it
- Some call sites need updating

### Reject / needs discussion (建议拒绝/需讨论)
- Major version bump with breaking changes
- Removed exports used by callers
- Return type changed and callers depend on old type
- Package deprecated without migration path
- Security concerns with new version

## Posting to PR (REQUIRED)

After generating the local report file, the full report MUST be posted as a PR comment so team members can review it directly in the PR.

```bash
# Post the full report as a PR comment
gh pr comment PR_NUMBER --body "$(cat node_modules/.cache/pkg-upgrade/REPORT_FILE.md)"
```

If the report exceeds GitHub's comment length limit (~65536 chars), split into multiple comments:

```bash
# Comment 1: Code diff and call sites
gh pr comment PR_NUMBER --body "$(cat <<'EOF'
# PACKAGE OLD -> NEW 升级分析 (1/2)

## 一、代码差异
...

## 二、项目中的调用位置
...
EOF
)"

# Comment 2: Compatibility assessment
gh pr comment PR_NUMBER --body "$(cat <<'EOF'
# PACKAGE OLD -> NEW 升级分析 (2/2)

## 三、兼容性评估
...
EOF
)"
```
