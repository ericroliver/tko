# TinyTask → TKO

- Repository: `ericroliver/tko` (rename in GitHub Settings → General after merging).
- Client source and npm package: `tko-cli`; executable: `tko` (`tko.exe` on Windows).
- Server npm package: `tko`; command and Docker image: `tko-mcp`.
- Standalone outputs remain `dist/tko-linux`, `dist/tko-macos`, and `dist/tko-win.exe`. Install them as `tko` or `tko.exe` on PATH. Re-run `npm link` from `tko-cli` for source installs.
- `TKO_*` environment variables take precedence over equivalent `TINYTASK_*` variables; legacy variables still work.
- CLI configuration uses `.tkorc.json` and cosmiconfig's `tko` names. Existing `~/.tinytaskrc.json` and legacy cosmiconfig files remain fallbacks. Saving updates the legacy home file until you move it to `.tkorc.json`. `TKO_CONFIG_PATH` (or `TINYTASK_CONFIG_PATH`) overrides the home path.
- Database filenames (`tinytask.db`, including dev/SSE variants) and shipped host data mounts remain unchanged. Keep the database path pointed at existing data.
- Compose service/container/image/network names now use `tko`. Stop the old deployment using its old Compose file before starting the renamed one. Preserve existing bind mounts and custom volume names; preserve the Compose project name with `-p` if the checkout directory changes and you use project-scoped volumes. Update custom overrides to the new service names.
- MCP advertised names and SignalR event `source` now use `tko` / `tko-mcp`. Update consumers filtering the old source. API routes, tools, and database schemas are unchanged.

After renaming the repository:

```bash
git remote set-url origin https://github.com/ericroliver/tko.git
```

Build and deploy after merging. Existing releases/installed binaries are not rebuilt by this change. No npm publication or lab deployment is performed.
