---
name: reviewer
description: Code reviewer task management skill for developer-to-developer code review — review pickup, feedback, approval, and handoff workflows.
---

# Code Reviewer Task Management Skill

> **Agent names (e.g., `tko-sword`, `tko-shield`) are examples.** Use actual names from your environment — defined in your `AGENTS.md` file. Replace placeholders like `<your-agent>`, `<developer>`, `<qa-agent>` with real names.

## Role Overview

| Aspect | Detail |
|---|---|
| Agent | `<your-agent>` (e.g., `tko-sword`) — any developer assigned as reviewer |
| Pickup queue | `ready-for-code-review` |
| Status discipline | `working` on review start → `idle` on review completion — **never `complete`** |
| CLI reference | See `SKILL.md` for full command syntax |

> **Agent identity:** Set `TKO_AGENT` in your environment. Used as `created_by` for tasks, comments, links. Alternatively, pass `--created-by <agent>` per command, or `tko config set agent <your-agent>`.

## Your Queue

| Queue | Role | When |
|---|---|---|
| `ready-for-code-review` | Monitor | Implementation ready for developer-to-developer review |
| `ready-for-qa` | Handoff | Review approved — route to QA for verification |
| `ready-for-development` | Handoff | Changes requested — kick back to original developer |
| `blocked` | Staging | Waiting on a dependency |

## Review Pickup (B5)

```bash
tko queue view --mine                                          # Check your queue
tko task get <id> --json && tko comment list <id>          # Read developer's completion comment + history
tko link list <id>                                             # Find the PR/branch link
tko task update <id> --status working                           # Set working
tko comment add <id> "Starting code review."
```

Read the developer's completion comment first — it tells you what to focus on. Review the linked PR or branch diff.

## Review Checklist

| Area | What to Check |
|---|---|
| Code quality | SOLID/DRY, consistent naming, no dead code, no leftover debug statements |
| TypeScript | No `any` in production — `unknown` or specific types; `z.ZodRawShape` for Zod schemas |
| Error handling | Edge cases covered, meaningful error messages, no swallowed exceptions |
| Tests | New features have tests; no removed tests; coverage maintained or improved |
| Boundaries | Don't cross transport → MCP → service → database layers |
| Security | Input validation, auth checks, no hardcoded secrets |

## Changes Requested (B5)

```bash
tko comment add <id> "Review: changes requested.
1. <specific issue with file/line reference>
2. <specific issue>
<additional feedback>"
tko task update <id> --status idle
tko queue move <id> ready-for-development
tko move <id> <developer> --comment "Changes requested. See review comment. Please address and re-submit."
```

## Review Approved (B5)

```bash
tko comment add <id> "Code review passed. <what was checked, any minor notes>. Approving for QA."
tko task update <id> --status idle
tko queue move <id> ready-for-qa
tko move <id> <qa-agent> --comment "Review approved. Ready for QA verification."
```

## Expedited Review

For genuinely trivial changes (typo fixes, comment updates, one-line changes), skip code review and go directly to QA:

```bash
tko comment add <id> "Trivial change: <description>. Skipping code review, going directly to QA."
tko task update <id> --status idle
tko queue move <id> ready-for-qa
```

## Reviewing Parent Tasks with Multiple Subtasks

When an entire parent task needs review, aggregate the subtask reviews:

```bash
# Move all completed subtasks to review, assign to same reviewer for consistency
for sub_id in <sub1-id> <sub2-id> <sub3-id>; do
  tko queue move "$sub_id" ready-for-code-review
  tko task update "$sub_id" --assigned-to <your-agent>
done
tko comment add <parent-id> "All subtasks moved to ready-for-code-review. Reviewing in dependency order: <ordering>."
```

Review in dependency order — schema before endpoints, utilities before consumers. Handle each subtask individually (approve or request changes).

## Reviewer Rules

| Rule | Detail |
|---|---|
| Never mark `complete` | Only testers/QA mark `complete` after verification |
| Always provide specific feedback | Reference files, line numbers, patterns — not just "fix this" |
| Review the code, not the developer | Focus on the implementation, not who wrote it |
| Don't offload basic checks | Developer should self-review first — don't catch what they should have |
| Address feedback promptly | When your own task gets review feedback, address it quickly — don't let it linger |
| Always `idle` before handoff | Never move a `working` task to another queue |
| Always comment on changes | Status, queue, assignee — every change gets a comment |
| Link to code in feedback | Reference specific files, line numbers, or PR sections |

## Pre-Review Checklist

- [ ] Read developer's completion comment (what was done, how tested, reviewer focus areas)
- [ ] Reviewed the linked PR or branch diff
- [ ] Checked code quality (SOLID/DRY, naming, dead code, debug statements)
- [ ] Verified TypeScript standards (no `any`, proper types, Zod schemas)
- [ ] Checked test coverage (new tests for new features, no removed tests)
- [ ] Verified architectural boundaries (no cross-layer violations)
- [ ] Wrote approval or changes-requested comment with specifics
- [ ] Updated status to `idle`, moved to correct queue, reassigned

## Quick Reference

```bash
# Review pickup
tko queue view --mine && tko task get <id> --json && tko comment list <id>
tko link list <id>
tko task update <id> --status working
tko comment add <id> "Starting code review."

# Changes requested
tko comment add <id> "Review: changes requested. 1. <issue> 2. <issue>"
tko task update <id> --status idle && tko queue move <id> ready-for-development
tko move <id> <developer> --comment "Changes requested. See review comment."

# Review approved
tko comment add <id> "Review passed. <notes>. Approving for QA."
tko task update <id> --status idle && tko queue move <id> ready-for-qa
tko move <id> <qa-agent> --comment "Approved. Ready for QA."

# Expedited (trivial changes only)
tko comment add <id> "Trivial change: <desc>. Skipping review."
tko task update <id> --status idle && tko queue move <id> ready-for-qa

# Parent with multiple subtasks
for sub_id in <sub1> <sub2> <sub3>; do
  tko queue move "$sub_id" ready-for-code-review
  tko task update "$sub_id" --assigned-to <your-agent>
done
tko comment add <parent-id> "All subtasks in review. Order: <dependency ordering>."
```
