# Implementation Workflow

For every phase:
1. audit the current repo state relevant to the phase
2. inspect current Supabase state via MCP where relevant
3. state the exact files to create/update
4. state the exact MCP actions to take
5. implement only the requested phase
6. update or create supporting docs
7. summarize changes and remaining manual steps

Do not:
- silently expand scope
- redesign unrelated frontend areas
- introduce broad refactors without necessity
- add hidden technical debt without calling it out

When schema or infra changes are involved:
- prefer clear migrations
- keep docs synchronized with code
- keep changes incremental and reversible where practical