# Constraints

Last reviewed: <date> by <person>

## Floor (always enforced)

- No new suppression comments (`@ts-ignore`, `eslint-disable`, `# noqa`, `# type: ignore`, and this stack's equivalents)
- No unimplemented stubs or empty `catch` blocks
- No skipped or deleted tests without a reason in the commit message
- No secrets in source
- This file is not weakened to make a change pass

Checked by: `node scripts/floor-guard.mjs --base <base branch>`

## Enforced with numbers

| Dimension | Rule | Checked by | Runs at | Verdict owner |
|-----------|------|------------|---------|---------------|
| Types | Zero type errors | `<command>` | every edit | external |
| Lint | Zero errors from our config | `<command>` | every edit | project |
| Coverage | Changed lines at least <N>% covered | `<command>` | task end, CI | suite |
| Security: deps | Nothing at high or above | `<command>` | CI | external |

## Measured, not yet enforced

| Metric | Today | Direction | Measured by |
|--------|-------|-----------|-------------|
| Project coverage | <N>% | must not fall | `<command>` |

## Exceptions

Number each row E1, E2 and so on. The floor guard finds new exceptions by that ID.

| ID | Rule waived | Where | Why | Expires |
|----|-------------|-------|-----|---------|
