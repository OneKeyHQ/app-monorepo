---
name: 1k-new-skill
description: Creates a new Claude Code Skill following best practices. Use when the user wants to create a new skill, add a skill, or asks about writing skills for Claude Code. Fetches latest documentation before generating skill content. New skill. Create a skill.
allowed-tools: Read, Grep, Glob, WebFetch, Write
---

# Creating a New Skill

Follow this workflow when creating a new Claude Code Skill.

## 0) Fetch latest best practices (REQUIRED)

Before writing any skill content, you MUST fetch and read the latest documentation:

1. **Skills overview**: https://code.claude.com/docs/en/skills
2. **Best practices**: https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices

Use WebFetch to retrieve these pages and extract key guidelines before proceeding.

## 1) Check if skill should merge into existing skill (REQUIRED)

**Before creating a new skill, first check if the content belongs in an existing skill.**

### Review existing skills
```bash
ls -la .claude/skills/
```

### Decision criteria for merging

**MERGE into existing skill as a rule if:**
- Topic is closely related to an existing skill's domain
- Content would be a sub-topic of an existing skill
- Similar workflows or patterns already exist
- Adding as a rule keeps related knowledge together

**CREATE new skill if:**
- Topic is distinct and doesn't fit any existing category
- Content is substantial enough to warrant standalone skill
- Different trigger keywords and use cases
- Would make existing skill too large or unfocused

### Token optimization considerations

**When to split existing skills:**

Skills should be split when they become too large, causing unnecessary token consumption on every load. Use these criteria:

**🚨 SPLIT if any of these apply:**
- **File size**: Reference file >10 KB or >1000 lines
- **Usage frequency mismatch**: Topics used in very different scenarios
- **Independent workflows**: Topics don't share common patterns
- **Specific trigger words**: Topic has distinct keywords that rarely overlap

**✅ KEEP TOGETHER if:**
- **High correlation**: Topics frequently used together (>50% overlap)
- **Shared concepts**: Common patterns, terminology, or workflows
- **Small files**: All reference files <5 KB each
- **Natural grouping**: User thinks of topics as related

**Token savings formula:**

```
Token Savings = (Skill_Size × Probability_Not_Needed) - Split_Overhead

Where:
- Skill_Size: Total tokens in skill (SKILL.md + all references)
- Probability_Not_Needed: % of tasks that don't need this topic
- Split_Overhead: ~500-1000 tokens (new SKILL.md + metadata)
```

**Real-world examples from our codebase:**

| Original | Size | Split Into | Token Savings |
|----------|------|------------|---------------|
| `1k-coding-patterns` | 15 KB (9 files) | 6 focused skills | 47-53% in 90% cases |
| `1k-dev-workflows` | 43 KB (3 files) | 3 focused skills | 80% when not doing Sentry |

**Splitting strategies:**

1. **Conservative split** (safe, minimal disruption):
   - Split only the largest, most independent file
   - Keep related topics together
   - Example: Split 34 KB Sentry analysis from 43 KB workflows

2. **Moderate split** (balanced):
   - Split 3-5 distinct topics into separate skills
   - Keep core patterns together
   - Example: Split date, i18n, error-handling, cross-platform, code-quality

3. **Aggressive split** (maximum optimization):
   - Each major topic becomes its own skill
   - Only keep truly inseparable content together
   - Use when: Very large skill (>50 KB), low topic correlation

### Existing skill categories for OneKey

| Category | Skill | Merge candidates |
|----------|-------|------------------|
| Feature development | `1k-feature-guides` | New chains, socket events, notifications, pages, routes |
| Code quality | `1k-code-quality` | Lint fixes, pre-commit tasks, documentation |
| Sentry analysis | `1k-sentry-analysis` | Crash reports, AppHang, ANR fixes |
| Test versions | `1k-test-version` | Upgrade testing, version migration |
| Native module patches | `1k-patching-native-modules` | iOS/Android crash fixes, native code patches |
| Error monitoring | `1k-sentry` | Error filtering, crash configuration |
| Architecture | `1k-architecture` | Project structure, import rules |
| Coding patterns | `1k-coding-patterns` | React patterns, TypeScript conventions |
| Performance | `1k-performance` | Optimization, concurrent requests, memoization |
| Error handling | `1k-error-handling` | Try/catch, error boundaries, user-facing errors |
| State management | `1k-state-management` | Jotai atoms, global state |
| Cross-platform | `1k-cross-platform` | Platform-specific code |
| Date formatting | `1k-date-formatting` | Date/time display, locale formatting |
| i18n | `1k-i18n` | Translations, locales |
| Git workflow | `1k-git-workflow` | Branching, commits, PRs |
| Dev commands | `1k-dev-commands` | Build, test, lint commands |

### Merging workflow

If merging into existing skill:

1. **Add as a rule file:**
   ```
   .claude/skills/<existing-skill>/
   ├── SKILL.md                          # Update quick reference
   └── references/rules/
       └── <new-topic>.md                # Add detailed content here
   ```

2. **Update the main SKILL.md:**
   - Add entry to quick reference table
   - Add brief summary section
   - Link to the new rule file

3. **Example merge:**
   ```markdown
   ## Quick Reference

   | Feature | Guide | Key Files |
   |---------|-------|-----------|
   | Existing topic | [existing.md](references/rules/existing.md) | `path/to/files` |
   | **New topic** | [new-topic.md](references/rules/new-topic.md) | `path/to/files` |  <!-- Add this -->
   ```

### Splitting workflow

If splitting an existing skill:

1. **Analyze current skill:**
   ```bash
   # Check file sizes
   ls -lh .claude/skills/<skill-name>/references/rules/
   wc -l .claude/skills/<skill-name>/references/rules/*.md
   ```

2. **Identify split candidates:**
   - Files >10 KB or >1000 lines
   - Topics with distinct trigger words
   - Workflows used independently

3. **Create new skill directories:**
   ```bash
   mkdir -p .claude/skills/<new-skill-1>/references/rules
   mkdir -p .claude/skills/<new-skill-2>/references/rules
   ```

4. **Move files (git tracks as rename):**
   ```bash
   mv .claude/skills/<old-skill>/references/rules/<topic>.md \
      .claude/skills/<new-skill>/references/rules/
   ```

5. **Create SKILL.md for each new skill:**
   - Write focused description with specific trigger words
   - Add Quick Reference section
   - Include Related Skills section

6. **Update original skill SKILL.md:**
   - Remove split topics from Quick Reference
   - Update Related Skills to point to new skills

7. **Update cross-references:**
   ```bash
   # Find all skills that reference the old skill
   grep -r "old-skill" .claude/skills/*/SKILL.md

   # Update each reference to point to appropriate new skill
   ```

8. **Commit with clear message:**
   ```bash
   git add -A .claude/skills/
   git commit -m "refactor: split <old-skill> into focused skills"
   ```

## 2) Gather requirements (for new skills)

If creating a new skill, ask the user:
- What task should this skill automate?
- What triggers should activate this skill? (keywords, file types, contexts)
- Should it be project-scoped (`.claude/skills/`) or personal (`~/.claude/skills/`)?
- What tools does it need? (Read, Grep, Glob, Bash, WebFetch, Write, etc.)

## 3) Create skill structure

### Standard structure (recommended for OneKey skills)

```
.claude/skills/1k-<skill-name>/
├── SKILL.md                    # Main entry with quick reference (required)
└── references/
    └── rules/
        ├── topic-1.md          # Detailed guide for topic 1
        ├── topic-2.md          # Detailed guide for topic 2
        └── topic-3.md          # Detailed guide for topic 3
```

### Simple structure (for single-topic skills)

```
.claude/skills/1k-<skill-name>/
└── SKILL.md                    # All content in one file
```

### SKILL.md template

```yaml
---
name: 1k-skill-name
description: Brief description of what this Skill does and when to use it. Include specific trigger keywords.
allowed-tools: Read, Grep, Glob  # Optional: restrict tool access
---

# Skill Title

Brief overview.

## Quick Reference

| Topic | Guide | Key Files |
|-------|-------|-----------|
| Topic 1 | [topic-1.md](references/rules/topic-1.md) | `path/to/files` |
| Topic 2 | [topic-2.md](references/rules/topic-2.md) | `path/to/files` |

## Topic 1 Summary

See: [references/rules/topic-1.md](references/rules/topic-1.md)

**Key points:**
- Point 1
- Point 2

## Topic 2 Summary

See: [references/rules/topic-2.md](references/rules/topic-2.md)

**Key points:**
- Point 1
- Point 2

## Related Skills

- `/1k-related-skill-1` - Description
- `/1k-related-skill-2` - Description
```

## 4) Apply best practices checklist

### Naming
- [ ] **REQUIRED**: Use `1k-` prefix for all OneKey project skills
- [ ] Use descriptive name: `1k-feature-guides`, `1k-dev-workflows`, `1k-sentry`
- [ ] Max 64 chars, lowercase letters/numbers/hyphens only
- [ ] No reserved words: "anthropic", "claude"

### Description
- [ ] Write in third person ("Processes...", not "I can help...")
- [ ] Include what it does AND when to use it
- [ ] Include specific trigger keywords users would say
- [ ] Max 1024 chars

### Content structure
- [ ] Main SKILL.md has quick reference table linking to rules
- [ ] Detailed content goes in `references/rules/*.md`
- [ ] Each rule file is self-contained and focused
- [ ] Keep SKILL.md body under 500 lines
- [ ] Use Unix-style paths (forward slashes)

### Organization
- [ ] Group related topics into one skill with multiple rules
- [ ] Use consistent formatting across all rules
- [ ] Include "Related Skills" section for cross-references
- [ ] Add checklist for complex workflows

## 5) Output the skill

After gathering requirements and applying best practices:
1. Create the skill directory with `references/rules/` structure
2. Write SKILL.md with quick reference table
3. Add rule files for each topic
4. Summarize what was created
5. **Run token analysis to verify optimization** (REQUIRED)

### Token Analysis (Self-Check)

**ALWAYS run after creating or modifying skills:**

```bash
# Run token analysis
python3 development/skills-analysis/analyze-skills-tokens.py --sort-by-size

# Check your new skill's token count
python3 development/skills-analysis/analyze-skills-tokens.py --detailed | grep -A 5 "your-skill-name"
```

**Verification checklist:**
- [ ] New skill is <5,000 tokens (ideal)
- [ ] If >5,000 tokens: Topics are highly correlated (>50% usage together)
- [ ] If >10,000 tokens: Plan immediate split
- [ ] SKILL.md has Quick Reference (avoid forcing full file load)
- [ ] No duplicate content across skills

**Action based on results:**

| Token Count | Action |
|-------------|--------|
| < 2,000 | ✅ Excellent - proceed |
| 2,000 - 5,000 | ✅ Good - proceed, monitor growth |
| 5,000 - 10,000 | ⚠️ Review: Can topics be split? If highly correlated, proceed with Quick Reference |
| > 10,000 | 🚨 Split before committing |

See [development/skills-analysis/SKILLS-TOKEN-MONITORING.md](../../../development/skills-analysis/SKILLS-TOKEN-MONITORING.md) for detailed guidance.

## Example: Skill with multiple rules

```
.claude/skills/1k-feature-guides/
├── SKILL.md
└── references/rules/
    ├── adding-chains.md
    ├── adding-socket-events.md
    ├── notification-system.md
    └── page-and-route.md
```

**SKILL.md content:**
```yaml
---
name: 1k-feature-guides
description: Feature development guides for OneKey. Use when adding new chains, socket events, notifications, pages, or routes.
---

# Feature Development Guides

## Quick Reference

| Feature | Guide | Key Files |
|---------|-------|-----------|
| Add blockchain chain | [adding-chains.md](references/rules/adding-chains.md) | `packages/core/src/chains/` |
| Add WebSocket events | [adding-socket-events.md](references/rules/adding-socket-events.md) | `packages/shared/types/socket.ts` |

## Adding New Chains

See: [references/rules/adding-chains.md](references/rules/adding-chains.md)

**Key steps:**
1. Implement chain core logic
2. Add chain configuration
3. Update UI components
```

## Anti-patterns to avoid

### Structure & Organization
- ❌ Creating new skill when content fits existing category
- ❌ Putting all content in SKILL.md (use references/rules for detail)
- ❌ Deeply nested file references (keep one level deep)
- ❌ Forgetting `1k-` prefix for OneKey skills

### Content Quality
- ❌ Vague descriptions like "Helps with documents"
- ❌ Multiple approaches without clear defaults
- ❌ Over-explaining what Claude already knows
- ❌ Missing trigger keywords in description

### Token Optimization Anti-patterns
- ❌ **Keeping bloated skills**: Not splitting when files exceed 10 KB
- ❌ **Over-splitting**: Creating separate skills for highly correlated topics
- ❌ **Ignoring usage patterns**: Not considering which topics are used together
- ❌ **Vague trigger words**: Using generic triggers that cause unnecessary loading
- ❌ **No Quick Reference**: Forcing full file load instead of showing summary first
- ❌ **Duplicate content**: Copying content across skills instead of cross-referencing

### Examples of Good vs Bad Splitting

**❌ BAD: Over-splitting**
```
1k-date-format-display
1k-date-format-parse
1k-date-format-locale
```
*Problem: These are always used together, split overhead > savings*

**✅ GOOD: Focused skill**
```
1k-date-formatting
├── SKILL.md (Quick Reference)
└── references/rules/date-formatting.md
```

**❌ BAD: Keeping bloated**
```
1k-coding-patterns (15 KB, 9 unrelated files)
```
*Problem: Loading all patterns even when only need one*

**✅ GOOD: Split by independence**
```
1k-coding-patterns (core patterns only)
1k-date-formatting (independent utility)
1k-i18n (independent utility)
1k-error-handling (independent patterns)
```
