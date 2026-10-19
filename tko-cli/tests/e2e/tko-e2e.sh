# Subtask Management
tko subtask create 7 "Design schema" -a alice
tko subtask tree 7 --recursive
tko subtask move 10 7

# Queue Management
tko queue list
tko queue stats dev
tko queue tasks dev --status idle
tko queue move 5 qa

# Enhanced Task Commands
tko task create "Fix bug" --queue dev --parent 5
tko task update 10 --parent null
tko task list --queue dev --exclude-subtasks
