# Code Quality and Deliverables

Implementation standards:
- TypeScript-first
- small, readable modules
- server-only boundaries enforced clearly
- no dead code
- no placeholder enterprise abstractions

Every phase response must include:
- files created/updated
- MCP actions performed
- manual dashboard steps still needed
- assumptions made
- intentionally deferred items

Prefer:
- bounded worker logic
- idempotent async handling
- explicit documentation
- simple naming
- maintainable folder structure

Avoid:
- over-normalization
- magic implicit behavior
- broad framework churn
- giant prompt frameworks