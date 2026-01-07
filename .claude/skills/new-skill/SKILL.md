---
name: new-skill
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

## 1) Gather requirements

Ask the user:
- What task should this skill automate?
- What triggers should activate this skill? (keywords, file types, contexts)
- Should it be project-scoped (`.claude/skills/`) or personal (`~/.claude/skills/`)?
- What tools does it need? (Read, Grep, Glob, Bash, WebFetch, Write, etc.)

## 2) Review existing skills for patterns

Check existing skills in the project for naming conventions and structure:
```bash
ls -la .claude/skills/
```

Read similar skills if they exist to maintain consistency.

## 3) Create skill structure

### Directory structure
```
.claude/skills/<skill-name>/
├── SKILL.md              # Main instructions (required)
├── reference/            # Optional: detailed docs
│   └── *.md
└── scripts/              # Optional: utility scripts
    └── *.py|*.sh
```

### SKILL.md format (required fields)
```yaml
---
name: skill-name-in-kebab-case
description: Brief description of what this Skill does and when to use it. Include specific trigger keywords.
allowed-tools: Read, Grep, Glob  # Optional: restrict tool access
---

# Skill Title

## Instructions
Clear, step-by-step guidance...
```

## 4) Apply best practices checklist

### Naming
- [ ] Use gerund form: `processing-pdfs`, `analyzing-code`, `creating-commits`
- [ ] Max 64 chars, lowercase letters/numbers/hyphens only
- [ ] No reserved words: "anthropic", "claude"

### Description
- [ ] Write in third person ("Processes...", not "I can help..." or "You can use...")
- [ ] Include what it does AND when to use it
- [ ] Include specific trigger keywords users would say
- [ ] Max 1024 chars

### Content
- [ ] Keep SKILL.md body under 500 lines
- [ ] Be concise - Claude is already smart
- [ ] Use progressive disclosure: put detailed content in separate files
- [ ] Keep file references one level deep from SKILL.md
- [ ] Use Unix-style paths (forward slashes)
- [ ] Avoid time-sensitive information

### Structure
- [ ] Provide concrete examples, not abstract descriptions
- [ ] Use consistent terminology throughout
- [ ] Include workflows for complex tasks
- [ ] Add validation/feedback loops for quality-critical tasks

## 5) Output the skill

After gathering requirements and applying best practices:
1. Create the skill directory
2. Write SKILL.md with proper frontmatter
3. Add reference files if needed (for content > 500 lines)
4. Summarize what was created

## Example: Simple skill

```yaml
---
name: generating-commit-messages
description: Generates clear commit messages from git diffs. Use when writing commit messages or reviewing staged changes.
---

# Generating Commit Messages

## Instructions

1. Run `git diff --staged` to see changes
2. Suggest a commit message with:
   - Summary under 50 characters
   - Detailed description
   - Affected components

## Best practices

- Use present tense
- Explain what and why, not how
```

## Anti-patterns to avoid

- Vague descriptions like "Helps with documents"
- Multiple approaches without clear defaults
- Assuming packages are installed without listing them
- Windows-style paths (`\` instead of `/`)
- Deeply nested file references (keep one level deep)
- Over-explaining what Claude already knows
