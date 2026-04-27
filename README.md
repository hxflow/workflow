# @hxflow/workflow

Harness Workflow — Agent Skill for requirement-to-delivery pipeline.

[中文文档](README.zh.md)

---

## Introduction

`hx` is an Agent Skill invoked via `/hx <command>` that orchestrates the full requirement-to-delivery pipeline.

Runtime config files:

- `.hx/config.yaml` — single-project config
- `.hx/workspace.yaml` — workspace root config (multi-project)
- `.hx/rules/*.md` — project rules
- `.hx/hooks/` — custom hooks (optional)
- `.hx/pipelines/` — custom pipelines (optional)

---

## Installation

```bash
npx skills add hxflow/workflow
```

After installation, run `/hx init` in your project to initialize.

---

## Usage

```
/hx go feature-name        # full pipeline
/hx doc feature-name       # gather requirements
/hx plan feature-name      # generate plan
/hx run feature-name       # execute tasks
/hx check feature-name     # quality check
/hx mr feature-name        # create MR
/hx reset feature-name [plan|doc|code]
```

---

## Commands

| Command | Phase | Description |
|---------|-------|-------------|
| `go` | Full | Full pipeline: `doc → plan → run → check → mr` |
| `doc` | Phase 01 | Gather requirements and create requirement doc |
| `plan` | Phase 02 | Generate execution plan and `progress.json` |
| `run` | Phase 04 | Execute tasks |
| `check` | Phase 06 | Quality gate (review, gates, engineering hygiene) |
| `mr` | Phase 08 | Create Merge Request |
| `init` | Init | Generate config file and rule templates |
| `status` | Status | View task progress |
| `reset` | Maintenance | Reset doc, plan, or code state |

---

## Architecture

```text
hxflow/
  SKILL.md              # Skill entry point
  commands/hx-*.md      # Command contracts
  scripts/tools/*.ts    # Fact-fetching scripts (structured data for AI)
  templates/            # Rule templates
```

Project scaffold:

```text
.hx/
  config.yaml           # single-project mode
  workspace.yaml        # multi-project (workspace) mode
  rules/
    requirement-template.md
    plan-template.md
    bugfix-requirement-template.md
    bugfix-plan-template.md
  hooks/                # optional
  pipelines/            # optional
```

`hx-init` copies rule templates into `.hx/rules/` and registers them in `config.yaml` (or `workspace.yaml`) under `rules.templates`; the runtime reads only from config.

---

## Multi-project Workspace

When the repo contains multiple sub-services, `hx-init` scans candidates and generates `.hx/workspace.yaml`:

- Root `workspace.yaml` holds the coordination layer: `paths`, `gates`, `runtime`, `rules.templates`, `projects`
- Sub-projects can have their own `config.yaml` to override only `cwd`, `src`, and gates; everything else inherits from workspace
- Requirement and plan docs are maintained at the workspace root; task-level changes are scoped to the target service
- Commands resolve the target project from the task's `cwd`, then merge workspace and project config by priority

---

## Requirements

- Bun >= 1.0.0; fall back to `npx tsx` if Bun is not available

---

## Testing

```bash
bun run hx:test              # full regression
bun run hx:test:unit         # unit tests
bun run hx:test:integration  # integration tests
```

---

## Publishing

- Repo: `https://github.com/hxflow/workflow`
- npm registry: `https://npm.pkg.github.com` (`@hxflow` scope)
- Push a `v*` tag to trigger automated release
- Provide `NODE_AUTH_TOKEN` for local publish

---

## Continuous Evals

Built-in agent evals scaffold at `hxflow/evals/`:

- `datasets/core.jsonl` — core pipeline samples
- `datasets/edge.jsonl` — edge cases
- `datasets/regressions.jsonl` — historical regression cases
- `runs/history.json` — trend history

```bash
bun run hx:evals:validate
bun hxflow/scripts/lib/evals.ts score tests/fixtures/evals/sample-results.json --write-run /tmp/hx-eval-run.json --record
bun run hx:evals:report
bun hxflow/scripts/lib/evals.ts extract-failures /tmp/hx-eval-run.json --output /tmp/hx-eval-candidates.jsonl
```

---

## License

MIT
