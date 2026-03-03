---
name: 1k-group-think
description: Spawns a team of 3 AI agents with different analytical perspectives to collaboratively analyze a problem, propose solutions, and debate trade-offs. Use when facing bugs, design decisions, architecture choices, or any task that benefits from multiple viewpoints. Agents discuss with each other, then present a comparison table for the user to decide. Triggers on "group think", "multi-agent", "team analysis", "3 agents", "collaborative analysis", "debate solutions".
---

# Multi-Agent Collaborative Analysis

Spawn 3 AI agent **team members** (NOT subagents) with distinct analytical perspectives. They communicate with each other via SendMessage, debate trade-offs, then present a unified comparison for the user to choose from.

## Prerequisites

Agent teams are experimental. Ensure the feature is enabled:

```json
// settings.json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

## Critical: Team Members vs Subagents

| | Subagent (WRONG for this skill) | Team Member (CORRECT) |
|---|---|---|
| Created by | `Task` + `run_in_background: true` | `Task` + `team_name` + `name` |
| Communication | Can only return results to caller | Can use `SendMessage` to talk to each other |
| Lifecycle | Runs once and exits | Stays alive, goes idle between turns, can receive messages |

**You MUST spawn agents as team members using `team_name` and `name` parameters. NEVER use `run_in_background: true`.**

## Workflow

### Step 1: Clarify the Problem (MANDATORY — Do NOT Skip)

Before ANY code exploration, use `AskUserQuestion` to fill in missing context. Ask up to 4 questions covering these dimensions:

| Dimension | Why It Matters | Example Question |
|-----------|---------------|-----------------|
| **Scope** | Narrow down what exactly is broken or needs design | "Which specific behavior is wrong — the animation, the data, or the layout?" |
| **Platform** | OneKey runs on 5 platforms; fixes differ wildly | "Which platforms are affected — iOS, Android, Desktop, Web, or Extension?" |
| **Reproduction** | Without steps, agents will guess | "What are the steps to reproduce? (or provide a screenshot/video link)" |
| **Constraints** | Business or tech constraints shape the solution | "Are there performance budgets, backward-compat requirements, or deadlines?" |

**Rules:**
- Only ask questions whose answers you genuinely cannot infer from the user's message or the codebase.
- If the user's description is already detailed (includes platform, steps, expected vs actual), skip directly to Step 2.
- Frame questions as multiple-choice with `AskUserQuestion` when possible — faster for the user.
- Maximum 1 round of questions. Do NOT ask follow-ups; gather what you can and move on.

### Step 2: Deep Codebase Exploration

After clarification, the team lead MUST thoroughly explore the codebase before spawning agents. Agents are expensive — giving them rich context upfront is far cheaper than having 3 agents each fumble through exploration independently.

**Use the `Task` tool with `subagent_type: "Explore"` for thorough codebase investigation:**

```
Task:
  subagent_type: "Explore"
  description: "Explore <topic> codebase"
  prompt: |
    Thoroughly investigate <problem description>.
    Find: entry points, call chains, state management, platform-specific code,
    related tests, recent git changes, and any TODO/FIXME/HACK comments.
    Return: file paths, key code snippets, and a dependency map.
```

**The exploration MUST produce a "Context Brief" covering:**

1. **Entry Point** — where the user interaction starts (e.g., which screen/component)
2. **Call Chain** — the full execution path (Component → Hook → Service → API)
3. **State Flow** — what state/atoms/stores are involved and how data flows
4. **Platform Branches** — any `.native.ts` / `.web.ts` / `.desktop.ts` / `.ext.ts` variants
5. **Key Code Snippets** — the actual code (not just file paths) for the critical sections (keep each snippet under 50 lines)
6. **Recent Changes** — `git log --oneline -10` on the relevant files to spot recent regressions
7. **Related Issues** — any TODO/FIXME/HACK comments or linked Jira tickets in the code
8. **Current Behavior vs Expected** — what the code does now vs what it should do

**This Context Brief will be embedded in every agent's prompt.** The quality of agent analysis is directly proportional to the quality of this brief.

### Step 3: Create the Team

Use TeamCreate to create a team:

```
TeamCreate:
  team_name: "analysis-<short-topic>"
  description: "Multi-agent analysis for <problem summary>"
```

### Step 4: Create Tasks (one per agent)

Use TaskCreate for each agent. These tasks go into the team's shared task list:
- Task #1: "Analyst A: root cause analysis" — conservative minimal fix
- Task #2: "Analyst B: best practices analysis" — industry standard approach
- Task #3: "Analyst C: creative analysis" — alternative approaches and edge cases

### Step 5: Spawn 3 Team Members in Parallel

Spawn all 3 agents **simultaneously** in a single message with 3 Task tool calls. Each MUST use:
- `team_name: "analysis-<short-topic>"` — joins the team
- `name: "analyst-a"` (or b, c) — the agent's name for messaging
- `subagent_type: "general-purpose"` — full tool access
- **NO** `run_in_background` — team members must stay alive to receive messages

#### Agent Perspectives

| Agent | Name | Focus |
|-------|------|-------|
| Agent A | `analyst-a` | Deep root cause analysis, conservative minimal fix |
| Agent B | `analyst-b` | Industry best practices, how native/standard implementations handle this |
| Agent C | `analyst-c` | Creative/alternative approaches, edge cases others might miss |

#### Agent Prompt Template

Each agent receives this prompt. The **Context Brief** from Step 2 is embedded directly — agents should NOT need to do extensive exploration themselves.

```
You are "<agent-name>", one of three AI analysts on team "<team-name>".
Your teammates are "<other-agent-1>" and "<other-agent-2>".
You are a TEAM MEMBER (not a subagent) — you can send and receive messages.

## Problem Statement
<1-2 sentence problem description from user, after clarification>

## User Constraints
- Platform(s) affected: <from Step 1 clarification>
- Reproduction steps: <from Step 1 clarification>
- Constraints/deadlines: <from Step 1 clarification, or "None specified">

## Context Brief (from team lead's codebase exploration)

### Entry Point
<which screen/component/route triggers this behavior>

### Call Chain
<Component → Hook → Service → Background API — the full execution path>

### State Flow
<what atoms/stores/context are involved, how data flows between them>

### Platform-Specific Code
<any .native.ts / .web.ts / .desktop.ts / .ext.ts variants found, or "None">

### Key Code Snippets
<the actual code for critical sections — NOT just file paths. Each snippet should be
under 50 lines and include the file path + line range as a header>

Example format:
--- packages/kit/src/views/Market/components/Banner.tsx:42-67 ---
<code snippet>
--- packages/kit-bg/src/services/MarketService.ts:120-145 ---
<code snippet>

### Recent Git Changes
<git log --oneline -10 output for relevant files, to spot recent regressions>

### Related Issues & Tech Debt
<any TODO/FIXME/HACK comments, linked Jira ticket IDs, or known issues>

### Current Behavior vs Expected Behavior
- Current: <what the code does now>
- Expected: <what it should do>

## Your Analytical Perspective
<specific focus area for this agent>

## Instructions

1. Use TaskUpdate to claim task #<N> and set status to "in_progress"
2. Review the Context Brief above carefully. You may read additional files if
   needed, but the brief should cover 80%+ of what you need.
3. Analyze the problem from your unique perspective
4. Propose a concrete solution with exact code changes (show old code → new code)
5. Send your analysis to BOTH teammates using SendMessage:
   - Use type: "message", recipient: "<teammate-name>", include a summary
   - Send to EACH teammate separately (do NOT use broadcast)
6. After receiving analyses from your teammates, review their proposals
7. Send a refined FINAL report to the team lead with:
   - Approach name (1 sentence)
   - Exact file paths and code changes
   - Pros and cons
   - Why your approach is better than the others (or acknowledge if another is better)
8. Use TaskUpdate to mark your task as "completed"
9. Go idle and wait — the team lead will shut you down when done

## Communication Format

When messaging teammates:
- SendMessage type: "message"
- recipient: "<teammate-name>" (e.g., "analyst-b")
- content: your full analysis
- summary: "Analysis from <your-name>: <1-line summary>"

When messaging team lead:
- SendMessage type: "message"
- recipient: "team-lead" (or the lead's name from team config)
- content: your FINAL refined report
- summary: "Final report from <your-name>"

## Important
- You ONLY analyze and propose. Do NOT edit any files or implement changes.
- You MUST message your teammates, not just the lead. Cross-agent discussion is the whole point.
- After sending your analysis, WAIT for teammate messages before submitting your final report.
- The Context Brief is your primary source of truth. Only explore further if something is missing.
```

### Step 6: Monitor and Facilitate

As team lead, your role is coordination:

1. **Wait for idle notifications** — teammates go idle after each turn, this is normal. They'll send you messages automatically when they have results.
2. **Monitor cross-agent discussion** — idle notifications include summaries of peer DMs. Verify agents are actually messaging each other.
3. **Nudge if needed** — if an agent hasn't messaged teammates after completing their analysis, send them a reminder:
   ```
   SendMessage type: "message", recipient: "analyst-a"
   content: "Please share your analysis with analyst-b and analyst-c before submitting your final report."
   ```
4. **Collect final reports** — wait for all 3 agents to send their final refined reports to you.
5. **Update tasks** — mark tasks as completed as agents submit final reports (if they haven't already).

### Step 7: Present Comparison

After all 3 agents submit final reports:

1. Create a comparison table:

```markdown
| Dimension | Analyst A (Conservative) | Analyst B (Best Practice) | Analyst C (Creative) |
|-----------|--------------------------|---------------------------|----------------------|
| Approach  | ...                      | ...                       | ...                  |
| Complexity| ...                      | ...                       | ...                  |
| Risk      | ...                      | ...                       | ...                  |
| Files changed | ...                  | ...                       | ...                  |
| Pros      | ...                      | ...                       | ...                  |
| Cons      | ...                      | ...                       | ...                  |
```

2. Add a recommendation with reasoning (but let user decide)
3. Present to user: "Which approach would you like to implement?"

### Step 8: Cleanup

1. Send `shutdown_request` to all 3 agents (they will approve and exit)
2. Wait for all agents to shut down
3. Use `TeamDelete` to clean up team resources

```
SendMessage type: "shutdown_request", recipient: "analyst-a"
SendMessage type: "shutdown_request", recipient: "analyst-b"
SendMessage type: "shutdown_request", recipient: "analyst-c"
# Wait for all to shut down, then:
TeamDelete
```

## Important Rules

- Agents ONLY analyze and propose. They do NOT implement code changes.
- All agents MUST communicate with each other via SendMessage (not just with team-lead).
- Agents must WAIT for teammate messages before submitting final reports.
- Always present the user with all 3 proposals before implementing anything.
- The user makes the final decision on which approach to use.
- Keep agents focused: each prompt should include the specific files to read.
- NEVER use `run_in_background: true` — this creates subagents that cannot communicate.
- Teammates go idle after each turn — this is NORMAL, not an error. Send them a message to wake them up.

## Example Invocation

User: "Use multi-agent analysis to figure out why the modal doesn't close properly on desktop"

Response flow:
1. AskUserQuestion → "Which platforms? What triggers the bug? Any constraints?"
2. Explore agent → deep-dive into modal/desktop code, produce Context Brief
3. TeamCreate → create team "analysis-modal-close"
4. TaskCreate × 3 → one task per analyst
5. Task × 3 (in parallel, with `team_name` and `name`) → spawn 3 team members with full Context Brief
6. Wait for cross-agent discussion (agents message each other)
7. Collect final proposals from all 3 agents
8. Present comparison table to user
9. User picks → implement the chosen approach
10. Shutdown all agents → TeamDelete
