# CLI Command Reference

> **Prerequisite:** Read [00-Foundation.md](./00-Foundation.md) for core concepts, data model, roles, and queue rules.
> **Scope:** Complete syntax reference for every `tko` CLI command, including options, aliases, examples, and output formats.

---

## 1. Overview

The `tko` CLI is a command-line interface for the TKO task management system. It communicates with a TKO MCP server over HTTP and provides commands for creating, updating, listing, and managing tasks, subtasks, queues, comments, links, and configuration.

### 1.1 Installation & Setup

The CLI binary is typically available at `/enigma-home/bin/tko` and should be on your `PATH`.

#### First-Time Initialization

```bash
tko config init
```

This creates a configuration file at `~/.tkorc.json` with default settings. Use `--force` to overwrite an existing config:

```bash
tko config init --force
```

#### Set Server URL

```bash
tko config set url http://your-server:3000/mcp
```

#### Set Agent Identity

Set `TKO_AGENT` in your environment (preferred), or use `tko config set agent <name>`. This is used as `created_by` for tasks, comments, and links.

```bash
# Option 1: Environment variable (preferred)
export TKO_AGENT=tko-sword

# Option 2: Config file
tko config set agent tko-sword
```

### 1.2 Global Options

All commands accept these global options. They can be placed before or after the subcommand.

| Option | Description |
|---|---|
| `--url <url>` | Override the TKO server URL for this invocation |
| `--json` | Output results as JSON (shorthand for `--output json`) |
| `--no-color` | Disable colored output |
| `--verbose` | Enable verbose logging |
| `--profile <profile>` | Use a specific configuration profile |

**Example:**

```bash
tko --url http://staging:3000/mcp --json task list
tko task list --profile staging
```

### 1.3 Environment Variables

The CLI reads these environment variables. CLI options take priority over environment variables, which take priority over config file values. `TKO_AGENT` takes precedence over `TKO_AGENT` if both are set.

| Variable | Description |
|---|---|
| `TKO_URL` | Server URL |
| `TKO_AGENT` | Agent identity — used for `created_by` on tasks, comments, links; `--from` on move; `--agent` on signup/queue view (preferred) |
| `TKO_AGENT` | Legacy alias for `TKO_AGENT` (backward compat) |
| `TKO_FORMAT` | Output format (`table`, `json`, `csv`, `compact`) |
| `TKO_NO_COLOR` | Set to `true` to disable color |
| `TKO_TIMEOUT` | Request timeout in milliseconds |

### 1.4 Configuration File

The config file is at `~/.tkorc.json`. Structure:

```json
{
  "url": "http://localhost:3000/mcp",
  "agent": "tko-sword",
  "outputFormat": "table",
  "colorOutput": true,
  "timeout": 30000,
  "profiles": {
    "staging": {
      "url": "https://staging.example.com/mcp",
      "agent": "staging-bot"
    }
  },
  "activeProfile": "staging"
}
```

**Precedence (highest to lowest):**

1. CLI flags (`--url`, `--json`, etc.)
2. Environment variables (`TKO_URL`, etc.)
3. Active profile values
4. Base config file values
5. Built-in defaults

---

## 2. Task Commands

Command group: `tko task` (alias: `tko t`)

### 2.1 Create Task

```bash
tko task create <title>
```

**Options:**

| Option | Short | Type | Default | Description |
|---|---|---|---|---|
| `--description <text>` | `-d` | string | — | Task description |
| `--assigned-to <agent>` | `-a` | string | — (unassigned) | Agent to assign the task to |
| `--created-by <agent>` | `-c` | string | `TKO_AGENT` env var or config `agent` | Agent who created the task (required) |
| `--priority <number>` | `-p` | integer | `0` | Task priority |
| `--tags <tags>` | `-t` | string | — | Comma-separated tag list |
| `--parent <id>` | — | integer | — | Parent task ID (creates as subtask) |
| `--queue <name>` | `-q` | string | — | Queue to assign the task to |

**Examples:**

```bash
# Create a basic task
tko task create "Implement pagination on task list endpoint"

# Create with full options
tko task create "Fix login redirect bug" \
  -d "Users are redirected to dashboard even when unauthenticated" \
  --assigned-to tko-sword \
  --priority 8 \
  --tags "bug,auth,api" \
  --queue ready-for-development

# Create as subtask
tko task create "Write unit tests" --parent 5 --assigned-to tko-sword

# Create with creator specified
tko task create "Research SQLite WAL mode" \
  -d "Investigate performance impact of WAL mode" \
  --created-by tko-shield \
  --assigned-to tko-sword \
  --tags "research,database"
```

### 2.2 Get Task

```bash
tko task get <id>
```

Retrieves a single task by its numeric ID. In table mode, displays the task with verbose detail.

**Examples:**

```bash
tko task get 5
tko task get 5 --json
```

### 2.3 Update Task

```bash
tko task update <id> [options]
```

Updates one or more fields on an existing task. Only specified options are applied.

**Options:**

| Option | Short | Type | Description |
|---|---|---|---|
| `--title <text>` | `-t` | string | Update the task title |
| `--description <text>` | `-d` | string | Update the task description |
| `--status <status>` | `-s` | string | Update status (`idle`, `working`, `complete`) |
| `--assigned-to <agent>` | `-a` | string | Update the assignee |
| `--priority <number>` | `-p` | integer | Update priority |
| `--tags <tags>` | — | string | Update tags (comma-separated, replaces existing) |
| `--parent <id>` | — | string | Change parent task ID. Use `null` to make top-level. |
| `--queue <name>` | `-q` | string | Change queue assignment |

**Examples:**

```bash
# Start working on a task
tko task update 5 --status working

# Reassign and change queue
tko task update 5 --assigned-to tko-shield --queue ready-for-testing

# Update priority and tags
tko task update 5 --priority 9 --tags "urgent,api"

# Make a subtask top-level
tko task update 10 --parent null

# Change parent
tko task update 10 --parent 5

# Finish work and hand off
tko task update 5 --status idle --queue ready-for-qa --assigned-to tko-shield
```

### 2.4 List Tasks

```bash
tko task list [options]
```

**Aliases:** `tko task ls`

**Options:**

| Option | Short | Type | Description |
|---|---|---|---|
| `--assigned-to <agent>` | `-a` | string | Filter by assignee |
| `--status <status>` | `-s` | string | Filter by status (`idle`, `working`, `complete`) |
| `--queue <name>` | `-q` | string | Filter by queue name |
| `--parent <id>` | — | integer | Filter by parent task ID |
| `--exclude-subtasks` | — | flag | Exclude subtasks from results |
| `--include-archived` | — | flag | Include archived tasks |
| `--limit <number>` | — | integer | Limit number of results |
| `--offset <number>` | — | integer | Offset for pagination |

**Examples:**

```bash
# List all tasks
tko task list

# List tasks assigned to an agent
tko task list --assigned-to tko-sword

# Filter by status
tko task list --status working

# Filter by queue
tko task list --queue ready-for-development

# List top-level tasks only (exclude subtasks)
tko task list --exclude-subtasks

# Include archived tasks
tko task list --include-archived

# Pagination
tko task list --limit 10 --offset 20

# Combined filters with JSON output
tko task list --assigned-to tko-sword --status idle --json
```

### 2.5 Archive Task

```bash
tko task archive <id>
```

Archives a task (soft-delete). The task is hidden from default list views but remains in the database with an `archived_at` timestamp.

**Examples:**

```bash
tko task archive 5
tko task archive 5 --json
```

### 2.6 Delete Task

```bash
tko task delete <id> [options]
```

Permanently deletes a task. Prompts for confirmation unless `--yes` is provided.

**Options:**

| Option | Short | Description |
|---|---|---|
| `--yes` | `-y` | Skip confirmation prompt |

**Examples:**

```bash
# Interactive (prompts for confirmation)
tko task delete 5

# Skip confirmation
tko task delete 5 --yes
```

---

## 3. Subtask Commands

Command group: `tko subtask` (alias: `tko st`)

### 3.1 Create Subtask

```bash
tko subtask create <parent-id> <title> [options]
```

Creates a new subtask under the specified parent task. The subtask inherits the parent's queue unless `--queue` is specified.

**Options:**

| Option | Short | Type | Description |
|---|---|---|---|
| `--description <text>` | `-d` | string | Subtask description |
| `--assigned-to <agent>` | `-a` | string | Agent to assign the subtask to (no default — unassigned if not specified) |
| `--priority <number>` | `-p` | integer | Priority (default: `0`) |
| `--tags <tags>` | `-t` | string | Comma-separated tags |
| `--queue <name>` | `-q` | string | Override queue (defaults to parent's queue) |

**Examples:**

```bash
# Basic subtask creation
tko subtask create 5 "Design database schema"

# Full options
tko subtask create 5 "Write integration tests" \
  -d "Integration tests for the new endpoint" \
  -a tko-sword \
  -p 7 \
  --tags "testing,api" \
  --queue ready-for-development
```

### 3.2 List Subtasks

```bash
tko subtask list <parent-id> [options]
```

**Aliases:** `tko subtask ls <parent-id>`

**Options:**

| Option | Short | Description |
|---|---|---|
| `--recursive` | `-r` | Include all nested subtasks (descendants at every level) |
| `--include-archived` | — | Include archived subtasks |

**Examples:**

```bash
# List direct subtasks
tko subtask list 5

# List all nested subtasks recursively
tko subtask list 5 --recursive

# Include archived subtasks
tko subtask list 5 --recursive --include-archived
```

### 3.3 Task Tree

```bash
tko subtask tree <task-id> [options]
```

Displays a task and all its descendants as a hierarchical tree.

**Options:**

| Option | Short | Description |
|---|---|---|
| `--recursive` | `-r` | Show complete subtask tree (all levels) |

**Example Output:**

```
Task #5: User Authentication [dev] (alice)
├── Task #10: Design schema (bob)
│   └── Task #15: Create ERD (alice)
├── Task #11: Write tests (charlie)
└── Task #12: Deploy (unassigned)
```

**Examples:**

```bash
tko subtask tree 5
tko subtask tree 5 --recursive
```

### 3.4 Move Subtask

```bash
tko subtask move <subtask-id> [new-parent-id]
```

Moves a subtask to a different parent, or makes it a top-level task if no new parent is specified.

**Examples:**

```bash
# Move to a different parent
tko subtask move 10 5

# Make top-level (remove parent relationship)
tko subtask move 10
```

---

## 4. Queue Commands

Command group: `tko queue` (alias: `tko q`)

### 4.1 View Agent Queue

```bash
tko queue view [agent] [options]
```

Displays all tasks assigned to an agent, organized by queue.

**Options:**

| Option | Short | Description |
|---|---|---|
| `--status <status>` | `-s` | Filter by status |
| `--mine` | — | View your own queue (uses `agent` from config) |

**Examples:**

```bash
# View a specific agent's queue
tko queue view tko-sword

# View your own queue (uses TKO_AGENT)
tko queue view --mine

# Filter by status
tko queue view tko-sword --status idle
```

### 4.2 List All Queues

```bash
tko queue list
```

**Aliases:** `tko queue ls`

Lists all queue names known to the server.

**Example:**

```bash
tko queue list
tko queue ls --json
```

### 4.3 Queue Statistics

```bash
tko queue stats <queue-name>
```

Displays statistics for a specific queue, including task counts by status, assignment breakdown, and assigned agents.

**Example Output (table format):**

```
Queue: dev
─────────────────────────
Total Tasks:     12
  Idle:          5
  Working:       4
  Complete:      3

Assignment:
  Assigned:      10
  Unassigned:    2

Agents:          alice, bob, charlie
```

**Examples:**

```bash
tko queue stats ready-for-development
tko queue stats ready-for-qa --json
```

### 4.4 View Tasks in Queue

```bash
tko queue tasks <queue-name> [options]
```

Lists all tasks in a specific queue with optional filters.

**Options:**

| Option | Short | Type | Description |
|---|---|---|---|
| `--status <status>` | `-s` | string | Filter by status (`idle`, `working`, `complete`) |
| `--assigned-to <agent>` | `-a` | string | Filter by assigned agent |
| `--exclude-subtasks` | — | flag | Exclude subtasks from results |
| `--include-archived` | — | flag | Include archived tasks |
| `--limit <number>` | `-l` | integer | Limit number of results |
| `--offset <number>` | `-o` | integer | Offset for pagination |

**Examples:**

```bash
# All tasks in a queue
tko queue tasks ready-for-development

# Filter by status
tko queue tasks ready-for-qa --status idle

# Filter by assignee
tko queue tasks ready-for-development --assigned-to tko-sword

# Exclude subtasks
tko queue tasks ready-for-development --exclude-subtasks

# Pagination
tko queue tasks ready-for-development --limit 5 --offset 10
```

### 4.5 Add Task to Queue

```bash
tko queue add <task-id> <queue-name>
```

Assigns a task to a queue. If the task is already in a different queue, it will be moved.

**Example:**

```bash
tko queue add 5 ready-for-development
```

### 4.6 Remove Task from Queue

```bash
tko queue remove <task-id>
```

Removes a task from its current queue. The task remains in the system but is unassigned to any queue.

**Example:**

```bash
tko queue remove 5
```

### 4.7 Move Task Between Queues

```bash
tko queue move <task-id> <new-queue>
```

Moves a task from its current queue to a new queue. This is the primary command for queue transitions (e.g., `ready-for-development` → `ready-for-qa`).

**Example:**

```bash
tko queue move 5 ready-for-qa
tko queue move 5 ready-for-testing
```

### 4.8 Clear Queue

```bash
tko queue clear <queue-name> [options]
```

Removes all tasks from a queue. Requires `--yes` to confirm; without it, displays a warning and exits without modifying.

**Options:**

| Option | Short | Description |
|---|---|---|
| `--yes` | `-y` | Skip confirmation and clear the queue |

**Examples:**

```bash
# Without --yes: shows warning, does not clear
tko queue clear blocked

# With --yes: clears all tasks from the queue
tko queue clear blocked --yes
```

---

## 5. Agent Workflow Commands

### 5.1 Signup for Task

```bash
tko signup [options]
```

Claims the next available idle task from the agent's queue. The task's status is set to `working` and it is assigned to the requesting agent. Returns `null` / "No idle tasks available" if no tasks are waiting.

**Options:**

| Option | Short | Description |
|---|---|---|
| `--agent <name>` | `-a` | Agent name (defaults to `agent` from config) |

**Examples:**

```bash
# Signup using agent from config
tko signup

# Specify agent explicitly
tko signup --agent tko-sword

# JSON output
tko signup --json
```

### 5.2 Move Task Between Agents

```bash
tko move <id> <to-agent> [options]
```

Transfers a task from one agent to another. Automatically adds a comment to the task documenting the transfer.

**Options:**

| Option | Short | Type | Default | Description |
|---|---|---|---|---|
| `--from <agent>` | `-f` | string | `agent` from config | Current agent (source) |
| `--comment <text>` | `-m` | string | `"Task transferred"` | Handoff comment added to the task |

**Examples:**

```bash
# Transfer to another agent
tko move 5 tko-shield

# Specify source agent and custom comment
tko move 5 tko-shield --from tko-sword --comment "Transferring for QA review"

# Using TKO_AGENT from config
tko move 5 tko-shield -m "Handing off for testing"
```

---

## 6. Comment Commands

Command group: `tko comment` (alias: `tko c`)

### 6.1 Add Comment

```bash
tko comment add <task-id> <content> [options]
```

**Aliases:** `tko c add <task-id> <content>`

**Options:**

| Option | Description |
|---|---|
| `--created-by <agent>` | Comment author (defaults to `agent` from config) |

**Examples:**

```bash
# Add a comment (uses TKO_AGENT as author)
tko comment add 5 "Started working on this task"

# Specify author explicitly
tko comment add 5 "Found the root cause: missing null check" --created-by tko-sword

# Add a handoff comment
tko c add 5 "Work complete, handing off to QA for verification" --created-by tko-sword
```

### 6.2 List Comments

```bash
tko comment list <task-id>
```

**Aliases:** `tko c list <task-id>`

**Examples:**

```bash
tko comment list 5
tko c list 5 --json
```

### 6.3 Update Comment

```bash
tko comment update <comment-id> <content>
```

**Examples:**

```bash
tko comment update 10 "Updated: the fix also requires a migration script"
```

### 6.4 Delete Comment

```bash
tko comment delete <comment-id> [options]
```

**Aliases:** `tko c delete <comment-id>`

**Options:**

| Option | Short | Description |
|---|---|---|
| `--yes` | `-y` | Skip confirmation (note: the current implementation does not prompt; the flag is accepted for future use) |

**Examples:**

```bash
tko comment delete 10
tko c delete 10 --yes
```

---

## 7. Link Commands

Command group: `tko link` (alias: `tko l`)

### 7.1 Add Link

```bash
tko link add <task-id> <url> [options]
```

**Aliases:** `tko l add <task-id> <url>`

**Options:**

| Option | Short | Description |
|---|---|---|
| `--description <text>` | `-d` | Link description |
| `--created-by <agent>` | — | Link author (defaults to `agent` from config) |

**Examples:**

```bash
# Add a PR link
tko link add 5 "https://github.com/org/repo/pull/123" \
  -d "Fixes the pagination bug" \
  --created-by tko-sword

# Add a documentation link
tko link add 5 "https://docs.example.com/api-spec" -d "API specification"
```

### 7.2 List Links

```bash
tko link list <task-id>
```

**Aliases:** `tko l list <task-id>`

**Examples:**

```bash
tko link list 5
tko l list 5 --json
```

### 7.3 Update Link

```bash
tko link update <link-id> [options]
```

**Options:**

| Option | Description |
|---|---|
| `--url <url>` | New URL |
| `--description <text>` | New description |

**Examples:**

```bash
tko link update 5 --url "https://github.com/org/repo/pull/124"
tko link update 5 --description "Updated PR link"
```

### 7.4 Delete Link

```bash
tko link delete <link-id> [options]
```

**Aliases:** `tko l delete <link-id>`

**Options:**

| Option | Short | Description |
|---|---|---|
| `--yes` | `-y` | Skip confirmation (accepted for compatibility; the current implementation deletes immediately) |

**Examples:**

```bash
tko link delete 5
tko l delete 5 --yes
```

---

## 8. Configuration Commands

Command group: `tko config`

### 8.1 Initialize Config

```bash
tko config init [options]
```

Creates a new configuration file at `~/.tkorc.json` with default values.

**Options:**

| Option | Short | Description |
|---|---|---|
| `--force` | `-f` | Overwrite an existing configuration file |

**Examples:**

```bash
tko config init
tko config init --force
```

### 8.2 Show Config

```bash
tko config show
```

Displays the current configuration, including the config file path.

**Example:**

```bash
tko config show
```

### 8.3 Set Config Value

```bash
tko config set <key> <value>
```

Sets a configuration key to a value. Common keys:

| Key | Description |
|---|---|
| `url` | Server URL |
| `agent` | Agent identity |
| `outputFormat` | Output format (`table`, `json`, `csv`, `compact`) |
| `colorOutput` | Enable/disable color (`true`/`false`) |
| `timeout` | Request timeout in milliseconds |

**Examples:**

```bash
tko config set url http://localhost:3000/mcp
tko config set agent tko-sword
tko config set outputFormat json
tko config set colorOutput false
```

### 8.4 Get Config Value

```bash
tko config get <key>
```

**Examples:**

```bash
tko config get url
tko config get agent
```

### 8.5 Profile Management

Command group: `tko config profile`

Profiles allow switching between different TKO server environments (e.g., local, staging, production).

#### Add Profile

```bash
tko config profile add [options]
```

**Required Options:**

| Option | Short | Description |
|---|---|---|
| `--name <name>` | `-n` | Profile name |
| `--server-url <url>` | `-u` | TKO server URL |

**Optional Options:**

| Option | Description |
|---|---|
| `--agent <agent>` | Agent identity for this profile |

**Example:**

```bash
tko config profile add \
  --name staging \
  --server-url https://staging.example.com/mcp \
  --agent staging-bot
```

#### List Profiles

```bash
tko config profile list
```

Lists all configured profiles, marking the active one.

**Example:**

```bash
tko config profile list
```

#### Use Profile

```bash
tko config profile use <name>
```

Sets the active profile. All subsequent commands will use this profile's server URL and agent identity.

**Example:**

```bash
tko config profile use staging
```

#### Remove Profile

```bash
tko config profile remove <name>
```

Removes a profile from configuration. If the removed profile was active, the active profile is unset.

**Example:**

```bash
tko config profile remove staging
```

---

## 9. Utility Commands

### 9.1 Ping

```bash
tko ping
```

Tests that the CLI is installed and working. Prints "TKO CLI is working!" — does not connect to a server.

**Example:**

```bash
tko ping
```

### 9.2 Version

```bash
tko --version
tko -V
```

Prints the CLI version.

---

## 10. Output Formats

The CLI supports multiple output formats. Use `--json` as a global flag, or set the format permanently with `tko config set outputFormat <format>`.

### 10.1 Table (Default)

Human-readable table output with colors. Best for interactive terminal use.

```bash
tko task list
tko task get 5
```

### 10.2 JSON

Machine-parseable JSON. Best for scripting and piping to tools like `jq`.

```bash
tko task list --json
tko task get 5 --json
tko task list --json | jq -r '.[] | .id'
```

### 10.3 CSV

Spreadsheet-compatible CSV output.

```bash
tko config set outputFormat csv
tko task list
```

To pipe to a file:

```bash
tko task list > tasks.csv
```

> **Note:** CSV format is available via config (`outputFormat: "csv"`) or the `TKO_FORMAT=csv` environment variable. There is no `--csv` CLI flag. Use `--json` for one-off scripting.

### 10.4 Compact

One-line summary per task. Useful for quick scanning of many tasks.

```bash
tko config set outputFormat compact
tko task list
```

> **Note:** Compact format is available via config (`outputFormat: "compact"`) or the `TKO_FORMAT=compact` environment variable. There is no `--compact` CLI flag.

### 10.5 Tree

Hierarchical tree display for subtask structures. Used automatically by `tko subtask tree`.

```bash
tko subtask tree 5
tko subtask tree 5 --recursive
```

### 10.6 Stats

Formatted statistics display for queue metrics. Used automatically by `tko queue stats`.

```bash
tko queue stats ready-for-development
```

---

## 11. Common Workflows

### 11.1 Complete Development Cycle

```bash
# 1. Create a task
tko task create "Implement feature X" \
  -d "Add new feature with API endpoint" \
  -a tko-sword \
  -p 7 \
  --tags "feature,api" \
  --queue ready-for-development

# 2. Pick up the task
tko signup --agent tko-sword

# 3. Mark as working
tko task update 5 --status working

# 4. Add progress comment
tko comment add 5 "Started implementation. API design in progress."

# 5. Add a PR link
tko link add 5 "https://github.com/org/repo/pull/42" -d "Implementation PR"

# 6. Finish work — set idle and hand off to QA
tko task update 5 --status idle
tko queue move 5 ready-for-qa
tko task update 5 --assigned-to tko-shield
tko comment add 5 "Implementation complete. Ready for QA review."
```

### 11.2 Defect Fix Cycle

```bash
# 1. Tester files a defect
tko task create "Login fails with special characters in password" \
  -d "Passwords containing <, >, & cause 500 error" \
  -a tko-sword \
  -p 9 \
  --tags "bug,auth,urgent" \
  --queue ready-for-development

# 2. Developer picks up, fixes, and hands back
tko signup --agent tko-sword
tko task update 10 --status working
tko comment add 10 "Root cause: unescaped SQL input. Fixed with parameterized query."
tko task update 10 --status idle
tko queue move 10 ready-for-testing
tko move 10 tko-shield -m "Fix complete, please verify"

# 3. Tester verifies
tko signup --agent tko-shield
tko comment add 10 "Verified fix — special characters now work correctly."
tko task update 10 --status complete
```

### 11.3 Scripting Example

```bash
#!/bin/bash
# Get all idle tasks assigned to tko-sword in JSON format
TASKS=$(tko task list --assigned-to tko-sword --status idle --json)

# Process each task
echo "$TASKS" | jq -r '.[] | .id' | while read task_id; do
  echo "Processing task $task_id"
  tko comment add "$task_id" "Auto-processed by script" --created-by tko-sword
done
```

### 11.4 Subtask Decomposition

```bash
# Create parent task
tko task create "Refactor authentication module" \
  -d "Split monolithic auth into separate concerns" \
  -a tko-sword \
  -p 8 \
  --tags "refactor,auth" \
  --queue ready-for-development

# Decompose into subtasks
tko subtask create 5 "Extract token validation logic" -d "Move JWT validation to separate module"
tko subtask create 5 "Update middleware chain" -d "Adjust Express middleware to use new auth module"
tko subtask create 5 "Write integration tests" -d "End-to-end tests for all auth flows"

# View the tree
tko subtask tree 5 --recursive
```

---

## 12. Command Quick Reference

### Task Commands

| Command | Syntax |
|---|---|
| Create | `tko task create <title> [-d <desc>] [-a <agent>] [-c <creator>] [-p <priority>] [-t <tags>] [--parent <id>] [-q <queue>]` |
| Get | `tko task get <id>` |
| Update | `tko task update <id> [-t <title>] [-d <desc>] [-s <status>] [-a <agent>] [-p <priority>] [--tags <tags>] [--parent <id\|null>] [-q <queue>]` |
| List | `tko task list [-a <agent>] [-s <status>] [-q <queue>] [--parent <id>] [--exclude-subtasks] [--include-archived] [--limit <n>] [--offset <n>]` |
| Archive | `tko task archive <id>` |
| Delete | `tko task delete <id> [-y]` |

### Subtask Commands

| Command | Syntax |
|---|---|
| Create | `tko subtask create <parent-id> <title> [-d <desc>] [-a <agent>] [-p <priority>] [-t <tags>] [-q <queue>]` |
| List | `tko subtask list <parent-id> [-r] [--include-archived]` |
| Tree | `tko subtask tree <task-id> [-r]` |
| Move | `tko subtask move <subtask-id> [new-parent-id]` |

### Queue Commands

| Command | Syntax |
|---|---|
| View Agent Queue | `tko queue view [agent] [-s <status>] [--mine]` |
| List Queues | `tko queue list` |
| Queue Stats | `tko queue stats <queue-name>` |
| Queue Tasks | `tko queue tasks <queue-name> [-s <status>] [-a <agent>] [--exclude-subtasks] [--include-archived] [-l <limit>] [-o <offset>]` |
| Add to Queue | `tko queue add <task-id> <queue-name>` |
| Remove from Queue | `tko queue remove <task-id>` |
| Move Between Queues | `tko queue move <task-id> <new-queue>` |
| Clear Queue | `tko queue clear <queue-name> [-y]` |

### Workflow Commands

| Command | Syntax |
|---|---|
| Signup | `tko signup [-a <agent>]` |
| Move Between Agents | `tko move <id> <to-agent> [-f <from-agent>] [-m <comment>]` |

### Comment Commands

| Command | Syntax |
|---|---|
| Add Comment | `tko comment add <task-id> <content> [--created-by <agent>]` |
| List Comments | `tko comment list <task-id>` |
| Update Comment | `tko comment update <comment-id> <content>` |
| Delete Comment | `tko comment delete <comment-id> [-y]` |

### Link Commands

| Command | Syntax |
|---|---|
| Add Link | `tko link add <task-id> <url> [-d <desc>] [--created-by <agent>]` |
| List Links | `tko link list <task-id>` |
| Update Link | `tko link update <link-id> [--url <url>] [--description <text>]` |
| Delete Link | `tko link delete <link-id> [-y]` |

### Config Commands

| Command | Syntax |
|---|---|
| Init | `tko config init [-f]` |
| Show | `tko config show` |
| Set | `tko config set <key> <value>` |
| Get | `tko config get <key>` |
| Profile Add | `tko config profile add -n <name> -u <url> [--agent <agent>]` |
| Profile List | `tko config profile list` |
| Profile Use | `tko config profile use <name>` |
| Profile Remove | `tko config profile remove <name>` |

### Utility Commands

| Command | Syntax |
|---|---|
| Ping | `tko ping` |
| Version | `tko --version` |
| Help | `tko --help` or `tko <command> --help` |

---

## 13. Command Aliases Summary

| Full Command | Alias |
|---|---|
| `tko task` | `tko t` |
| `tko task list` | `tko task ls` |
| `tko subtask` | `tko st` |
| `tko subtask list` | `tko st ls` |
| `tko queue` | `tko q` |
| `tko queue list` | `tko queue ls` |
| `tko comment` | `tko c` |
| `tko link` | `tko l` |

---

## Cross-References

| Topic | Reference |
|---|---|
| Core concepts, data model, roles, queues | [00-Foundation.md](./00-Foundation.md) |
| Task lifecycle scenarios (create, start, complete, archive) | [Scenario Group A](./01-Scenario-Group-A-Core-Task-Lifecycle.md) |
| Development workflows (subtask decomposition, parallel work) | [Scenario Group B](./02-Scenario-Group-B-Development-Workflows.md) |
| QA & bug workflows (filing, fixing, verifying) | [Scenario Group C](./03-Scenario-Group-C-QA-and-Bug-Workflows.md) |
| Task dependencies, linking, bulk operations | [Scenario Group D](./04-Scenario-Group-D-Task-Organization-and-Dependencies.md) |
| Comments, cross-queue handoffs, coordination | [Scenario Group E](./05-Scenario-Group-E-Collaboration-and-Communication.md) |
| Conventions & best practices | [Conventions & Best Practices](./07-Conventions-and-Best-Practices.md) |

---

*This document is part of the TKO Process Manual. See [00-Foundation.md](./00-Foundation.md) for core concepts and [other scenario documents](.) for specialized workflows.*
