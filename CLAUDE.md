<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
at specs/001-pokemon-collection-tracker/plan.md
<!-- SPECKIT END -->

Active feature: specs/001-pokemon-collection-tracker/ (spec, plan, research,
data-model, contracts/openapi.yaml, quickstart). Project principles:
.specify/memory/constitution.md. Stack: Kotlin/Spring Boot 4.1 api + React 19/
@rauboti/ui web, Postgres, hive OAuth (BFF), ports 3040/5040/5436. All stat math
server-side (api stats/); species/move data synced, never hardcoded; CPM/dust/type
chart vendored.

## Git workflow (non-negotiable)

Every implementation task gets a FRESH feature branch off `main`, created BEFORE any
code (an increment = ONE task; never reuse the previous task's branch). Agents never
commit, push, or merge — leave work uncommitted; Gaute reviews, commits, and merges
each task before the next. If prior work is uncommitted when a new task starts,
surface it and ask. Preflight every implement task: state current branch, the fresh
branch created, and tree state. Enforced by `.claude/hooks/block-main-edits.js`
(blocks Write/Edit to implementation files on main; specs/, .specify/, .claude/,
CLAUDE.md exempt).
