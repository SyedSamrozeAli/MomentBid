# Git Workflow

## Commit Message Format
```
[ <type> ] <description>

<optional body>
```
Types: BUG FIX, FEATURE, REFACTOR, DOCS, TEST, CHORE, ENHANCEMENT

Donot commit all of the files at once. Instead, break down into logical commits with clear messages. Each commit should represent a single logical change.


Note: Attribution disabled globally via ~/.claude/settings.json.

## Pull Request Workflow

When creating PRs:
1. Analyze full commit history (not just latest commit)
2. Use `git diff [base-branch]...HEAD` to see all changes
3. Draft comprehensive PR summary
4. Include test plan with TODOs
5. Push with `-u` flag if new branch

> For the full development process (planning, TDD, code review) before git operations,
> see [development-workflow.md](./development-workflow.md).
