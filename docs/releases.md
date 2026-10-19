# CI and releases

`.github/workflows/build.yml` runs on pull requests targeting `main`, pushes to `main`, manual dispatch, and `v*` tag pushes. PRs, branch pushes, and manual runs build/test only. Publishing requires a pushed stable tag of the form `vMAJOR.MINOR.PATCH` whose commit is reachable from `origin/main`. An off-main or malformed tag fails before any publish job.

## Publish a release

After the workflow PR is merged, from an up-to-date checkout:

```bash
git switch main
git pull --ff-only origin main
git tag -a v2.3.0 -m "TKO 2.3.0"
git push origin v2.3.0
```

Use a new version for each release. `v2.3.0` is an example. The build stamps both packages, lockfile root versions, MCP/OpenAPI server version, and CLI `--version` from the tag in the temporary build checkout; it does not commit version changes back to main. Dependency versions are unchanged. Development checkouts continue to report their checked-in versions.

## Published artifacts

| Artifact | Location |
| --- | --- |
| Linux server, amd64 + arm64 manifest | `ghcr.io/ericroliver/tko:v2.3.0` |
| Windows server, x64 / LTSC 2022 | `ghcr.io/ericroliver/tko:v2.3.0-windows-ltsc2022` |
| Linux x64 CLI | `tko-linux-x64.tar.gz` |
| Linux ARM64 CLI | `tko-linux-arm64.tar.gz` |
| macOS Intel CLI | `tko-macos-x64.tar.gz` |
| macOS Apple Silicon CLI | `tko-macos-arm64.tar.gz` |
| Windows x64 CLI | `tko-windows-x64.zip` |
| Download checksums | `SHA256SUMS` |

CLI files and checksums are attached to the GitHub Release. Archives contain `tko` (Unix) or `tko.exe` (Windows) and the license. There is no Node.js installation requirement on the destination machine. Linux binaries target glibc systems; use the server container on Alpine. macOS binaries are ad-hoc signed, not notarized, and Windows binaries do not have a publisher signature.

```bash
# After downloading release assets:
sha256sum -c SHA256SUMS --ignore-missing
tar -xzf tko-linux-x64.tar.gz
install -Dm755 tko ~/.local/bin/tko
tko --version

# Linux server (use your existing data directory on upgrades):
docker run -d --name tko -p 3000:3000 \
  -v tko-data:/data ghcr.io/ericroliver/tko:v2.3.0
```

Images default to HTTP mode and persist SQLite at `/data/tinytask.db` (Windows: `C:/data/tinytask.db`). Existing database filenames are preserved. Override with `TKO_MODE` / `TKO_DB_PATH` as needed; ensure the container user can write bind mounts. Windows images require a compatible Windows container host and a volume mounted at `C:/data`.

## Validation and permissions

The workflow runs server/CLI lint, builds, and tests; native CLI builds/tests and standalone `--version`/`--help` checks on all five platforms; native Linux amd64/arm64 and Windows container builds with native SQLite checks. The GitHub Release is published only after all build jobs succeed. CI archives are also available as workflow artifacts for 14 days.

The workflow uses `GITHUB_TOKEN` with job-scoped `packages: write` for GHCR and `contents: write` for the release. No PAT or custom secrets are needed. Actions must be enabled and repository/org policies must permit those token permissions. If a GHCR package already exists, grant this repository Actions write access to it. GHCR packages may initially be private even for a public repository; set the package visibility to public in package settings if anonymous pulls are wanted.

Linux images build on native x64 and ARM64 runners, publish architecture-suffixed tags (`-linux-amd64`, `-linux-arm64`), and are combined into the versioned multi-architecture manifest after every build succeeds.

Version tags are published; there is deliberately no rolling `latest` tag that an older rerun could move backward. A failure may leave versioned container images or a draft release, but the release remains unpublished until all jobs succeed. Rerun a failed tag workflow to retry. Rerunning a fully published release refuses to replace its assets. Use a new version for changed code; do not move release tags. Container pushes happen before the release and are not transactional with it.

This pipeline publishes artifacts; it does not update running Enigma/lab containers or install binaries on your machines. It does not publish npm packages.

## Runtime baseline

Builds retain the existing project's Node 20 / better-sqlite3 ABI baseline, pinned to Node 20.20.2 for native builds and Windows containers. The Linux Dockerfile uses the existing `node:20-alpine` line. A runtime/dependency upgrade should be a separate tested change.

References: [GitHub container publishing](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images), [GHCR permissions and visibility](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry), [Node SEA packaging](https://nodejs.org/download/release/latest-jod/docs/api/single-executable-applications.html).
