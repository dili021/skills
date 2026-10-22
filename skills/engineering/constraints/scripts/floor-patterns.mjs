// Patterns shared by the floor guard and the gate: which files are tests, which configure a
// checker, what a suppression or a skipped test looks like. floor-guard.config.json beside this
// file picks the stacks and adds the repo's own patterns:
//   { "stacks": ["dotnet", "ts", "python"], "extra": { "test": ["^verify/prove/"], ... } }
// With no config file every stack is on. A bad config throws; callers report it as "could not run".
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Patterns per stack. Each stack names how a checker gets silenced, what unfinished work looks
// like, how a test gets skipped, which files are tests, what an assertion looks like, and which
// files configure its checkers. `lines` covers files that mix dependencies with checker settings:
// those are flagged by line, so a version bump stays quiet.
export const STACKS = {
  ts: {
    suppress: /@ts-ignore|@ts-nocheck|eslint-disable|biome-ignore|istanbul ignore|Stryker disable/,
    stub: /throw new (Error|NotImplemented).*[Nn]ot implemented|catch\s*\(\w*\)\s*\{\s*\}|catch\s*\{\s*\}/,
    skip: /\.(skip|todo|only)\b|\bxit\(|\bxdescribe\(|\bfit\(|\bfdescribe\(/,
    test: /\.(test|spec)\.[cm]?[jt]sx?$/,
    assert: /\b(expect|assert|should)\b/,
    config: /(^|\/)(eslint\.config\.[cm]?[jt]s|\.eslintrc(\.[a-z]+)?|\.eslintignore|tsconfig[^/]*\.json|biome\.jsonc?|(vitest|jest|playwright|cypress)\.config\.[cm]?[jt]s|karma\.conf\.[cm]?js)$/,
    lines: [
      [/(^|\/)package\.json$/, /^\s*"(check|lint|test|typecheck|type-check)[^"]*"\s*:/, 'check scripts'],
      [/(^|\/)angular\.json$/, /"(maximumWarning|maximumError|codeCoverage|lintFilePatterns)"\s*:/, 'budgets and lint'],
    ],
  },
  dotnet: {
    suppress: /#pragma warning disable|#nullable disable|SuppressMessage\(|ReSharper disable/,
    stub: /throw new NotImplementedException|catch\s*(\([^)]*\))?\s*\{\s*\}/,
    skip: /\[(Fact|Theory)\(Skip|\[Ignore\b|Assert\.(Ignore|Inconclusive)\(/,
    test: /Tests?\.cs$|(^|\/)[^/]*\.Tests?\/.*\.cs$/,
    assert: /\bAssert\b|\.Should\(/,
    config: /(^|\/)(\.editorconfig|\.globalconfig|Directory\.Build\.(props|targets)|stylecop\.json|[^/]*\.ruleset)$/,
    lines: [
      [/\.(cs|fs|vb)proj$/, /<(NoWarn|Nullable|TreatWarningsAsErrors|WarningsAsErrors|WarningsNotAsErrors|WarningLevel|AnalysisLevel|AnalysisMode|EnforceCodeStyleInBuild)>/, 'warning settings'],
    ],
  },
  python: {
    suppress: /# *noqa|# *type: *ignore/,
    stub: /\bpass\s*# *stub|raise NotImplementedError/,
    skip: /@pytest\.mark\.(skip|xfail)|@unittest\.skip/,
    test: /(^|\/)(test_[^/]*|[^/]*_test)\.py$|(^|\/)tests?\/.*\.py$/,
    assert: /\bassert\b/,
    config: /(^|\/)(\.?ruff\.toml|mypy\.ini|pyrightconfig\.json|pytest\.ini|tox\.ini|setup\.cfg|\.flake8)$/,
    lines: [
      [/(^|\/)pyproject\.toml$/, /^\s*(select|ignore|extend-select|extend-ignore|per-file-ignores|exclude|strict|disallow_\w+|warn_\w+|ignore_missing_imports|fail_under|addopts)\s*=/, 'checker settings'],
    ],
  },
  go: {
    skip: /t\.Skip\(/,
    test: /_test\.go$/,
    assert: /\bt\.(Error|Fatal)|\b(assert|require)\./,
  },
};
// On for every repo: scanner suppressions, TODO, CI, hooks, Claude Code's shared settings, and the
// scripts of the bar itself.
export const ANY = {
  suppress: /nosemgrep|gitleaks:allow/,
  stub: /\bTODO\b/,
  config: /(^|\/)(\.gitlab-ci\.yml|lefthook\.yml|\.pre-commit-config\.yaml|azure-pipelines[^/]*\.ya?ml|floor-guard\.config\.json|(floor-guard|floor-patterns|receipt|gate|stop-check|no-verify)\.mjs)$|(^|\/)\.github\/workflows\/|(^|\/)\.husky\/|(^|\/)\.githooks\/|(^|\/)\.claude\/settings\.json$/,
};


// Loads the config once and returns one regex per kind, plus the file predicates built on them.
export function loadPatterns(configPath = join(dirname(fileURLToPath(import.meta.url)), 'floor-guard.config.json')) {
  let config = {};
  if (existsSync(configPath)) {
    try { config = JSON.parse(readFileSync(configPath, 'utf8')); }
    catch { throw new Error('floor-guard.config.json is not valid JSON'); }
  }
  const stackNames = config.stacks ?? Object.keys(STACKS);
  for (const n of stackNames) {
    if (!STACKS[n]) throw new Error(`unknown stack "${n}" in floor-guard.config.json, known: ${Object.keys(STACKS).join(', ')}`);
  }
  const active = [ANY, ...stackNames.map((n) => STACKS[n])];
  // One regex per kind: every active stack's pattern, plus the repo's own from `extra`.
  const union = (kind) => {
    const parts = [...active.map((s) => s[kind]?.source), ...(config.extra?.[kind] ?? [])].filter(Boolean);
    try { return new RegExp(parts.length ? parts.join('|') : '(?!)'); }
    catch (e) { throw new Error(`bad "${kind}" pattern in floor-guard.config.json: ${e.message}`); }
  };
  const p = {
    SUPPRESSIONS: union('suppress'),
    STUBS: union('stub'),
    SKIPS: union('skip'),
    TESTS: union('test'),
    ASSERTS: union('assert'),
    CHECKER_CONFIG: union('config'),
    LINE_RULES: active.flatMap((s) => s.lines ?? []),
  };
  p.isTest = (f) => p.TESTS.test(f);
  p.isCheckerConfig = (f) => p.CHECKER_CONFIG.test(f);
  // Product code is what a verdict is about: every file that is not a test, a checker's config or
  // a Markdown document.
  p.isProduct = (f) => !p.isTest(f) && !p.isCheckerConfig(f) && !/\.md$/i.test(f);
  return p;
}
