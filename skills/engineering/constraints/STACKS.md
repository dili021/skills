# Checks by stack

The usual command behind each row of `CONSTRAINTS.md`, per stack. Use the repo's own script when it has one, and confirm every command by running it once. A repo with several stacks gets one set of rows per stack, each scoped to its own directory.

## .NET

| Dimension | Command | Notes |
|-----------|---------|-------|
| Types and analyzers | `dotnet build -warnaserror` | The compiler is the external verdict. `Nullable` and `TreatWarningsAsErrors` in the project files decide how much it checks |
| Format and style | `dotnet format --verify-no-changes` | Reads `.editorconfig` |
| Tests | `dotnet test` | |
| Coverage | `dotnet test --collect:"XPlat Code Coverage"` | Writes Cobertura XML. For changed lines, feed it to `diff-cover` |
| Security: deps | `dotnet list package --vulnerable --include-transitive` | |

Config the floor guard treats as part of the bar: `.editorconfig`, `.globalconfig`, `Directory.Build.props`, `*.ruleset`, `stylecop.json`, and the `NoWarn`, `Nullable` and warnings-as-errors lines of a project file.

## Python

| Dimension | Command | Notes |
|-----------|---------|-------|
| Lint | `ruff check` | |
| Format | `ruff format --check` | |
| Types | `mypy` or `pyright` | Whichever the repo already configures |
| Tests | `pytest` | |
| Coverage | `pytest --cov --cov-report=xml`, then `diff-cover coverage.xml --compare-branch=<base> --fail-under=<N>` | `diff-cover` reports changed lines only |
| Security: deps | `pip-audit` | |

Config the floor guard treats as part of the bar: `ruff.toml`, `mypy.ini`, `pyrightconfig.json`, `pytest.ini`, `tox.ini`, `setup.cfg`, `.flake8`, and the rule and threshold lines of `pyproject.toml`.

## TypeScript and JavaScript

| Dimension | Command | Notes |
|-----------|---------|-------|
| Types | `tsc --noEmit` | |
| Lint | `eslint .` or `biome check` | |
| Tests and coverage | the repo's runner with coverage on | |
| Security: deps | `npm audit --audit-level=high` or `osv-scanner` | |

## Any stack

| Dimension | Command | Notes |
|-----------|---------|-------|
| Secrets | `gitleaks detect --redact` | Can run in CI only |
| The floor | `node scripts/floor-guard.mjs --base <base>` | Needs Node on the machine that runs it |

## Code that calls a model

A check on model output has to be deterministic to be a row here: the response parses against its schema, the expected tool is called, a refusal happens where it must, a score over a fixed evaluation set stays at or above a recorded number. "The answer reads well" is a judgement, and it stays with a person.
