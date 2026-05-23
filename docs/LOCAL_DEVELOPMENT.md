# Local Development

Current phase: pre-foundation setup.

No application stack has been selected in this workspace yet. Do not add frameworks, package managers, or dependencies until the product foundation task starts or an existing project stack is discovered.

## Expected Future Workflow

1. Inspect existing project files before changing scripts.
2. Install dependencies only when the chosen app stack requires them.
3. Keep environment variables out of Git.
4. Run available validation before commits.
5. Update knowledge docs when meaningful product or architecture decisions change.

## Validation

When a package exists, prefer:

- `npm run lint`
- `npm run typecheck`
- `npm run build` when available
- Relevant tests when business logic changes

Do not invent unavailable scripts.
