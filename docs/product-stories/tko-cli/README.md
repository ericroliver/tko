# TKO CLI - Implementation Plan

## Overview

This directory contains the complete implementation plan for the TKO CLI, a command-line client that connects to TKO MCP servers via Streamable HTTP.

## Documentation Structure

### Product Documentation
- **[PRD](../../product/tko-cli-prd.md)** - Complete product requirements document with user stories, features, and success criteria

### Technical Documentation
- **[Architecture](../../technical/tko-cli-architecture.md)** - Detailed technical architecture, component design, and implementation patterns

### Implementation Stories

The implementation is broken down into 6 sequential stories:

#### Phase 1: Foundation (Stories 1-4)
1. **[Project Setup](./story-01-project-setup.md)** - Initialize project structure, build system, and basic CLI framework
   - Estimated: 1-2 hours
   - Dependencies: None

2. **[MCP Client Integration](./story-02-mcp-client-integration.md)** - Implement MCP client wrapper for Streamable HTTP
   - Estimated: 4-6 hours
   - Dependencies: Story 1

3. **[Configuration Management](./story-03-configuration-management.md)** - Multi-source configuration with profiles
   - Estimated: 4-6 hours
   - Dependencies: Story 1

4. **[Output Formatters](./story-04-output-formatters.md)** - Table, JSON, CSV, and compact formatters
   - Estimated: 4-6 hours
   - Dependencies: Story 1

#### Phase 2: Core Features (Stories 5-6)
5. **[Task Commands](./story-05-task-commands.md)** - All task CRUD operations and aliases
   - Estimated: 6-8 hours
   - Dependencies: Stories 1-4

6. **[Queue and Workflow Commands](./story-06-queue-and-workflow-commands.md)** - Queue management, signup, move, comments, links
   - Estimated: 6-8 hours
   - Dependencies: Stories 1-5

## Total Estimated Effort

- **Phase 1**: 13-20 hours
- **Phase 2**: 12-16 hours
- **Total**: 25-36 hours (approximately 1 week of focused development)

## Key Features

### Command Structure
```bash
tko [global-options] <command> [subcommand] [arguments] [options]
```

### Core Commands
- **Task Operations**: create, get, update, delete, list, archive
- **Queue Management**: queue, signup, move
- **Comments**: add, list, update, delete
- **Links**: add, list, update, delete
- **Configuration**: init, show, set, get, profile

### Output Formats
- **Table**: Human-readable with colors (default)
- **JSON**: Machine-parseable for scripts
- **CSV**: Export to spreadsheets
- **Compact**: Quick scanning (one line per task)

### Configuration Sources
1. Default values
2. Config file (`~/.tkorc`)
3. Active profile in config
4. Environment variables
5. CLI options (highest priority)

## Technology Stack

### Core
- **Node.js** (v18+) with TypeScript
- **@modelcontextprotocol/sdk** - MCP client
- **Commander.js** - CLI framework
- **Zod** - Schema validation

### UI/Formatting
- **chalk** - Terminal colors
- **cli-table3** - ASCII tables
- **cosmiconfig** - Configuration loading

### Build & Test
- **tsup** - Fast TypeScript bundler
- **Vitest** - Testing framework
- **ESLint + Prettier** - Code quality

## Example Usage

### Basic Task Management
```bash
# Create task
tko create "Fix login bug" \
  --assigned-to alice \
  --priority 10 \
  --tags bug,urgent

# View your queue
tko queue alice

# Claim next task
tko signup

# Update status
tko update 45 --status working

# Add comment
tko comment add 45 "Started investigation"

# Complete and transfer
tko update 45 --status complete
tko move 45 bob --comment "Needs review"
```

### CI/CD Integration
```bash
#!/bin/bash
# Create deployment task in pipeline

TASK_ID=$(tko create "Deploy v${VERSION}" \
  --assigned-to devops \
  --priority 10 \
  --json | jq -r '.id')

tko link add $TASK_ID \
  "https://github.com/repo/actions/runs/${RUN_ID}"

if deploy.sh; then
  tko update $TASK_ID --status complete
  tko comment add $TASK_ID "✓ Deployed successfully"
else
  tko comment add $TASK_ID "✗ Deployment failed"
  exit 1
fi
```

### Configuration
```bash
# Initialize config
tko config init

# Set default server
tko config set url http://localhost:3000/mcp

# Add production profile
tko config profile add prod \
  --url https://prod.example.com/mcp \
  --agent prod-agent

# Use profile
tko --profile prod task list
```

## Development Workflow

### Story Implementation Order
Stories should be implemented in numerical order as they have dependencies:

1. **Story 1** first - Foundation for everything
2. **Stories 2-4** in parallel - Independent components
3. **Story 5** next - Core task commands
4. **Story 6** last - Builds on task commands

### Testing Strategy
- **Unit Tests**: Test individual components (formatters, parsers, validators)
- **Integration Tests**: Test commands with mock/test server
- **E2E Tests**: Test full workflows with real TKO server
- **Manual Testing**: Verify UX and error messages

### Quality Gates
Each story must pass:
- [ ] Build succeeds: `npm run build`
- [ ] All tests pass: `npm test`
- [ ] Linting passes: `npm run lint`
- [ ] Code formatted: `npm run format`
- [ ] Manual testing completed
- [ ] Documentation updated

## Architecture Highlights

### Connection Management
- Single persistent connection per CLI invocation
- Automatic connection retry on transient failures
- Graceful error handling for connection issues
- Connection pooling for bulk operations (future)

### Configuration Precedence
```
CLI Flags > Env Vars > Active Profile > Config File > Defaults
```

### Error Handling
- Clear error messages with suggestions
- Proper exit codes (0=success, 1=error, 2=usage)
- Connection errors distinguished from data errors
- Validation errors show which field failed

### Performance Targets
- Simple operations: < 200ms
- List operations: < 500ms
- Bulk operations: < 2s for 100 items

## Future Enhancements

### Phase 3 (Post-MVP)
- Shell completions (bash, zsh, fish)
- Interactive prompts for missing params
- Task templates
- Workflow definitions
- Bulk operations

### Phase 4 (Advanced)
- Interactive TUI dashboard mode
- Real-time task watching
- Git integration
- Plugin system
- Time tracking
- Advanced reporting

## Success Criteria

### Functional
- [ ] All MCP tools accessible via CLI
- [ ] Configuration works from all sources
- [ ] All output formats render correctly
- [ ] Error messages are helpful
- [ ] Documentation is complete

### Non-Functional
- [ ] Response time < 200ms for simple ops
- [ ] Works on macOS, Linux, Windows
- [ ] No hanging processes
- [ ] Graceful handling of server unavailability
- [ ] Memory usage < 50MB

### User Experience
- [ ] Intuitive command structure
- [ ] Helpful error messages with suggestions
- [ ] Clear progress indicators
- [ ] Consistent output formatting
- [ ] Easy to script

## Distribution

### NPM Package
```bash
npm install -g tko-cli
```

### From Source
```bash
git clone https://github.com/org/tko-cli
cd tko-cli
npm install && npm run build && npm link
```

### Standalone Binary (Optional)
```bash
# Download binary for your platform
curl -L https://github.com/org/tko-cli/releases/download/v1.0.0/tko-linux -o tko
chmod +x tko
sudo mv tko /usr/local/bin/
```

## Support & Troubleshooting

### Common Issues

**Connection Refused**
```bash
# Check server is running
curl http://localhost:3000/mcp/health

# Verify URL in config
tko config show
```

**Command Not Found**
```bash
# Verify installation
which tko

# Re-link if needed
cd tko-cli && npm link
```

**Permission Denied**
```bash
# Check config file permissions
chmod 644 ~/.tkorc

# Check binary permissions
chmod +x $(which tko)
```

## Contributing

When implementing these stories:
1. Follow the architecture document closely
2. Write tests before implementation (TDD recommended)
3. Update documentation as you build
4. Test on multiple platforms if possible
5. Consider UX in error messages
6. Keep code DRY and maintainable

## Questions or Feedback

This plan is ready for review and approval. Key decisions made:
- ✅ MCP client mode via Streamable HTTP (not direct DB access)
- ✅ Support all use cases: human-friendly AND machine-parseable
- ✅ Hierarchical command structure with aliases
- ✅ Multi-source configuration with profiles
- ✅ Multiple output formats for flexibility
- ✅ Proper error handling and validation

Ready to proceed with implementation when approved.
