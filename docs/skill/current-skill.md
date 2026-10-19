---
name: task-management
description: Use the task management skill to check your queue for work, create tasks for others, reassign, etc.
---

We use the `tko` CLI and it is typically in your path.

### Task Commands

#### Create Task

```bash
tko task create "Task title"
tko task create "Task title" -d "Description" -a alice -p 5
tko task create "Task title" --assigned-to bob --priority 8 --tags "bug,urgent"

# Create as subtask
tko task create "Write tests" --parent 5 --assigned-to alice

# Create and assign to queue
tko task create "Fix bug" --queue dev --priority 8
```

#### Get Task

```bash
tko task get 1
tko task get 1 --json
```

#### Update Task

```bash
tko task update 1 --status working
tko task update 1 --title "New title" --priority 9
tko task update 1 --assigned-to charlie --tags "feature,ui"

# Change parent or make top-level
tko task update 10 --parent 5
tko task update 10 --parent null

# Change queue
tko task update 1 --queue qa
```

#### List Tasks

```bash
tko task list
tko task ls
tko task list --assigned-to alice
tko task list --status working --limit 10
tko task list --include-archived

# Filter by queue or parent
tko task list --queue dev
tko task list --parent 5
tko task list --exclude-subtasks
```

#### Delete Task

```bash
tko task delete 1
tko task delete 1 --yes
```

#### Archive Task

```bash
tko task archive 1
```

### Subtask Commands

Manage task hierarchies and break down complex work into subtasks.

#### Create Subtask

```bash
tko subtask create 5 "Design database schema"
tko st create 5 "Write tests" -d "Unit and integration tests" -a alice
tko st create 5 "Deploy feature" -p 8 -q qa
```

#### List Subtasks

```bash
tko subtask list 5
tko st list 5 --recursive
tko st list 5 --include-archived
```

#### View Task Tree

```bash
tko subtask tree 5
tko st tree 5 --recursive
```

Output displays hierarchical task structure:
```
Task #5: User Authentication [dev] (alice)
├── Task #10: Design schema (bob)
│   └── Task #15: Create ERD (alice)
├── Task #11: Write tests (charlie)
└── Task #12: Deploy (unassigned)
```

#### Move Subtask

```bash
# Move to different parent
tko subtask move 10 5

# Make top-level task
tko st move 10
```

### Queue Management Commands

Organize tasks into team queues (dev, product, qa, etc.).

#### List All Queues

```bash
tko queue list
tko queue ls
```

#### View Queue Statistics

```bash
tko queue stats dev
tko queue stats qa --json
```

Output displays queue metrics:
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

#### View Tasks in Queue

```bash
tko queue tasks dev
tko queue tasks dev --status idle
tko queue tasks dev --assigned-to alice
tko queue tasks qa --exclude-subtasks
```

#### Add Task to Queue

```bash
tko queue add 5 dev
```

#### Remove Task from Queue

```bash
tko queue remove 5
```

#### Move Task Between Queues

```bash
tko queue move 5 qa
```

#### Clear Queue

```bash
tko queue clear dev --yes
```

### Agent Workflow Commands

#### View Agent Queue

```bash
tko queue view alice
tko queue view --mine
```

#### Signup for Task

```bash
tko signup
tko signup --agent alice
```

#### Move Task Between Agents

```bash
tko move 1 bob
tko move 1 bob --from alice
tko move 1 bob --comment "Transferring to Bob"
```

### Comment Commands

#### Add Comment

```bash
tko comment add 1 "This is a comment"
tko c add 1 "Comment text" --created-by alice
```

#### List Comments

```bash
tko comment list 1
tko c list 1 --json
```

#### Update Comment

```bash
tko comment update 10 "Updated comment text"
```

#### Delete Comment

```bash
tko comment delete 10
tko c delete 10 --yes
```

### Link Commands

#### Add Link

```bash
tko link add 1 "https://github.com/user/repo/pull/123"
tko l add 1 "https://docs.example.com" -d "Documentation"
```

#### List Links

```bash
tko link list 1
tko l list 1 --json
```

#### Update Link

```bash
tko link update 5 --url "https://new-url.com"
tko l update 5 --description "New description"
```

#### Delete Link

```bash
tko link delete 5
tko l delete 5 --yes
```

### Configuration Commands

> **Agent identity:** Set `TKO_AGENT` in your environment. Used as `created_by` for tasks, comments, links. Alternatively, pass `--created-by <agent>` per command, or `tko config set agent <your-agent>`. `assigned_to` has no default — tasks are unassigned unless explicitly assigned.

#### Initialize Config

```bash
tko config init
tko config init --force
```

#### Show Config

```bash
tko config show
```

#### Set Config Value

```bash
tko config set url http://localhost:3000/mcp
tko config set agent alice
tko config set outputFormat json
```

#### Get Config Value

```bash
tko config get url
tko config get agent
```

#### Profile Management

```bash
# Add profile
tko config profile add staging --url https://staging.example.com/mcp --agent staging-bot

# List profiles
tko config profile list

# Use profile
tko config profile use staging

# Remove profile
tko config profile remove staging
```

## Output Formats

### Table Format (Default)

Human-readable table output with colors:

```bash
tko task list
```

### JSON Format

Machine-parseable JSON:

```bash
tko task list --json
tko task get 1 --json
```

### CSV Format

Spreadsheet-compatible CSV:

```bash
tko task list --output csv > tasks.csv
```

### Compact Format

One-line summary per task:

```bash
tko task list --output compact
```

### Tree Format

Hierarchical tree display for subtasks:

```bash
tko subtask tree 5
```

### Stats Format

Formatted statistics for queue metrics:

```bash
tko queue stats dev
```

## Examples

### Complete Workflow

```bash
# Create a new task
tko create "Implement feature X" -d "Add the new feature" -a alice -p 7

# View your queue
tko queue alice

# Claim next task
tko signup --agent alice

# Update task status
tko update 1 --status working

# Add a comment
tko comment add 1 "Started working on this"

# Add a link
tko link add 1 "https://github.com/org/repo/pull/42"

# Complete the task
tko update 1 --status complete

# Archive completed task
tko archive 1
```

### Scripting Example

```bash
#!/bin/bash
# Get all idle tasks assigned to alice in JSON format
TASKS=$(tko list --assigned-to alice --status idle --json)

# Process each task
echo "$TASKS" | jq -r '.[] | .id' | while read task_id; do
  echo "Processing task $task_id"
  tko comment add "$task_id" "Auto-processed by script"
done
```
