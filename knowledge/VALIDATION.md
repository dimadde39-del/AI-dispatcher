# Validation

## Standard Checks

Before committing implementation work, run the scripts that exist in the project:

- `npm run lint`
- `npm run typecheck`
- `npm run build` when available
- Relevant tests when business logic changes

Do not invent unavailable scripts. Inspect `package.json` first.

## Documentation-Only Changes

For documentation-only changes, validation may be limited to checking file structure and reviewing content. If there is no package or validation script, document that no automated validation was available.

## Business Logic Changes

When domain policies, lead status changes, extraction logic, webhook processing, or reporting calculations change, add or update focused tests.

## Commit Rule

Never commit if validation fails unless the failure is explicitly documented and accepted for the task.
