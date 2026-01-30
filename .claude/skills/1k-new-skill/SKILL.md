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

### Existing skill categories for OneKey

| Category | Skill | Merge candidates |
|----------|-------|------------------|
| Feature development | `1k-feature-guides` | New chains, socket events, notifications, pages, routes |
| Development workflows | `1k-dev-workflows` | Lint fixes, test versions, pre-commit tasks |
| Native module patches | `1k-patching-native-modules` | iOS/Android crash fixes, native code patches |
| Error monitoring | `1k-sentry` | Error filtering, crash analysis |
| Architecture | `1k-architecture` | Project structure, import rules |
| Coding patterns | `1k-coding-patterns` | React patterns, TypeScript conventions |
| State management | `1k-state-management` | Jotai atoms, global state |
| Cross-platform | `1k-cross-platform` | Platform-specific code |
| Git workflow | `1k-git-workflow` | Branching, commits, PRs |
| i18n | `1k-i18n` | Translations, locales |
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

- ❌ Creating new skill when content fits existing category
- ❌ Vague descriptions like "Helps with documents"
- ❌ Putting all content in SKILL.md (use references/rules for detail)
- ❌ Multiple approaches without clear defaults
- ❌ Deeply nested file references (keep one level deep)
- ❌ Over-explaining what Claude already knows
- ❌ Forgetting `1k-` prefix for OneKey skills
