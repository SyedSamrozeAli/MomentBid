# Agent Orchestration Rules


## When to Use Subagents
- Use a subagent for tasks that require focused expertise (security audit, performance analysis, test generation).
- Use a subagent when the main task would exceed the context window if done inline.
- Use a subagent for parallel work streams that do not depend on each other.
- Do not use a subagent for simple, single-step tasks. The overhead is not worth it.

## Subagent Design
- Give each subagent a clear, single responsibility and a defined scope.
- Specify the tools the subagent is allowed to use. Restrict to the minimum needed.
- Provide the subagent with relevant context, not the entire conversation history.
- Set explicit success criteria: what output is expected and in what format.

## Token Budget Management
- Track approximate token usage across the session.
- Use `/compact` when approaching 60% of the context window.
- Prefer reading specific file sections over entire files.
- Summarize findings instead of copying large code blocks verbatim.
- Use glob and grep to find relevant code before reading full files.

## Progressive Disclosure
- Start with the high-level structure before diving into details.
- Show the plan before executing it. Get confirmation on the approach.
- Report progress incrementally: what was done, what is next.
- Surface important decisions that need human input early in the process.

## Task Decomposition
- Break complex tasks into 3-7 sequential steps.
- Each step should produce a verifiable intermediate result.
- If a step fails, the previous steps should still be valid.
- Use checklists to track progress on multi-step tasks.

## Safety and Guardrails
- Never run destructive commands (rm -rf, DROP TABLE, force push) without explicit confirmation.
- Validate assumptions before acting on them. Read the code before modifying it.
- Prefer reversible changes. Commit before refactoring so rollback is easy.
- When uncertain, ask rather than guess. A wrong assumption costs more than a clarifying question.

## Communication Style
- Be direct and specific. State what you did, what you found, and what you recommend.
- When presenting options, list tradeoffs for each. Recommend one with reasoning.
- If something will take multiple steps, outline them upfront with estimated effort.
- After completing a task, summarize what changed and what to verify.

## Available Agents

Located in `.claude/agents/`:

| Agent | Purpose | When to Use |
|-------|---------|-------------|
| planner | Implementation planning | Complex features, refactoring |
| architect | System design | Architectural decisions |
| tdd-guide | Test-driven development | New features, bug fixes |
| code-reviewer | Code review | After writing code |
| security-reviewer | Security analysis | Before commits |
| build-error-resolver | Fix build errors | When build fails |
| refactor-cleaner | Dead code cleanup | Code maintenance |
| doc-updater | Documentation | Updating docs |

## Immediate Agent Usage

No user prompt needed:
1. Complex feature requests - Use **planner** agent
2. Code just written/modified - Use **code-reviewer** agent
3. Bug fix or new feature - Use **tdd-guide** agent
4. Architectural decision - Use **architect** agent

## Parallel Task Execution

ALWAYS use parallel Task execution for independent operations:

```markdown
# GOOD: Parallel execution
Example:
Launch 3 agents in parallel:
1. Agent 1: Security analysis of auth module
2. Agent 2: Performance review of cache system
3. Agent 3: Type checking of utilities

# BAD: Sequential when unnecessary
First agent 1, then agent 2, then agent 3
```

## Multi-Perspective Analysis

For complex problems, use split role sub-agents:
- Factual reviewer
- Senior engineer
- Security expert
- Consistency reviewer
- Redundancy checker
