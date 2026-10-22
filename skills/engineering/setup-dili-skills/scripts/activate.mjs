#!/usr/bin/env node
// Turns the flow on or off for this clone and this person. Nothing it changes is tracked by git.
//
//   node activate.mjs on <base> [--stop-hook "<check command>"]
//   node activate.mjs off <base>
//
// on:  for each hook in .githooks/ (pre-merge-commit, pre-commit), a small wrapper in git's own
//      hooks directory (.git/hooks, shared by every worktree). A hook already there is kept as
//      <name>.local and runs first, so tools like graphify or git-lfs keep working. Also
//      branch.<base>.mergeOptions=--no-ff, and in .claude/settings.local.json the PreToolUse hook
//      scripts/no-verify.mjs (when it exists) and, with --stop-hook, the Stop hook
//      scripts/stop-check.mjs running that command.
// off: removes exactly those, puts any <name>.local back, and leaves every file in the repo.
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const git = (...args) => {
  try { return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return null; }
};
const [mode, base] = process.argv.slice(2);
if (!['on', 'off'].includes(mode) || !base) {
  console.error('usage: activate.mjs on <base> [--stop-hook "<check command>"] | off <base>');
  process.exit(2);
}
const top = git('rev-parse', '--show-toplevel');
if (!top) { console.error('activate: not inside a git work tree'); process.exit(2); }
process.chdir(top);

const done = [];
const warn = [];

// Git hooks ------------------------------------------------------------------------------------
const HOOKS = ['pre-merge-commit', 'pre-commit'];
const MARK = '# dili-skills hook wrapper';
const wrapper = (name) => `#!/usr/bin/env bash
${MARK}: written by activate.mjs, removed by \`activate.mjs off\`.
# Runs the hook that was here before (kept as ${name}.local), then the repo's .githooks/${name}.
here="$(cd "$(dirname "$0")" && pwd)"
if [ -x "$here/${name}.local" ]; then "$here/${name}.local" "$@" || exit $?; fi
hook="$(git rev-parse --show-toplevel)/.githooks/${name}"
[ -f "$hook" ] || exit 0
exec bash "$hook" "$@"
`;
const isOurs = (p) => existsSync(p) && readFileSync(p, 'utf8').includes(MARK);

function gitHooks() {
  const managed = git('config', '--get', 'core.hooksPath');
  if (managed) {
    warn.push(`core.hooksPath is "${managed}", so git does not read .git/hooks here. Call .githooks/pre-merge-commit and .githooks/pre-commit from that hook manager to enforce check before a merge.`);
    return;
  }
  const dir = git('rev-parse', '--path-format=absolute', '--git-path', 'hooks');
  for (const name of HOOKS) {
    const target = join(dir, name), kept = `${target}.local`;
    if (mode === 'on') {
      if (!existsSync(join('.githooks', name))) continue;
      if (existsSync(target) && !isOurs(target)) {
        if (existsSync(kept)) { warn.push(`${target} and ${kept} both exist; left both alone, so ${name} does not run check`); continue; }
        renameSync(target, kept);
        done.push(`kept the existing ${name} hook as ${name}.local, it runs first`);
      }
      mkdirSync(dir, { recursive: true });
      writeFileSync(target, wrapper(name));
      chmodSync(target, 0o755);
      done.push(`git hook ${name} runs .githooks/${name}`);
    } else if (isOurs(target)) {
      rmSync(target);
      if (existsSync(kept)) renameSync(kept, target);
      done.push(`git hook ${name} removed${existsSync(target) ? ', the earlier hook is back' : ''}`);
    }
  }
}

// Claude Code hooks ----------------------------------------------------------------------------
const MARKERS = ['scripts/no-verify.mjs', 'scripts/stop-check.mjs'];
const settingsPath = join('.claude', 'settings.local.json');
const ours = (entry) => (entry.hooks ?? []).some((h) => MARKERS.some((m) => String(h.command).includes(m)));
const shellQuote = (s) => `'${s.replace(/'/g, `'\\''`)}'`;

function editSettings(change) {
  let s = {};
  if (existsSync(settingsPath)) {
    try { s = JSON.parse(readFileSync(settingsPath, 'utf8')); }
    catch { console.error(`activate: ${settingsPath} is not valid JSON, left as it is`); process.exit(2); }
  }
  s.hooks ??= {};
  for (const event of ['PreToolUse', 'Stop']) s.hooks[event] = (s.hooks[event] ?? []).filter((e) => !ours(e));
  change(s.hooks);
  for (const event of Object.keys(s.hooks)) if (s.hooks[event].length === 0) delete s.hooks[event];
  if (Object.keys(s.hooks).length === 0) delete s.hooks;
  mkdirSync('.claude', { recursive: true });
  writeFileSync(settingsPath, JSON.stringify(s, null, 2) + '\n');
}

gitHooks();
if (mode === 'on') {
  git('config', `branch.${base}.mergeOptions`, '--no-ff');
  done.push(`branch.${base}.mergeOptions = --no-ff, since a fast-forward runs no hook`);
  const i = process.argv.indexOf('--stop-hook');
  const stopCommand = i > -1 ? process.argv[i + 1] : null;
  editSettings((hooks) => {
    if (existsSync('scripts/no-verify.mjs')) {
      hooks.PreToolUse.push({ matcher: 'Bash', hooks: [{ type: 'command', command: 'node "$CLAUDE_PROJECT_DIR/scripts/no-verify.mjs"' }] });
      done.push('PreToolUse hook scripts/no-verify.mjs');
    }
    if (stopCommand) {
      hooks.Stop.push({ hooks: [{ type: 'command', command: `node "$CLAUDE_PROJECT_DIR/scripts/stop-check.mjs" -- ${shellQuote(stopCommand)}` }] });
      done.push(`Stop hook scripts/stop-check.mjs -- ${stopCommand}`);
    }
  });
} else {
  if (git('config', '--get', `branch.${base}.mergeOptions`) === '--no-ff') {
    git('config', '--unset', `branch.${base}.mergeOptions`);
    done.push(`branch.${base}.mergeOptions unset`);
  }
  if (existsSync(settingsPath)) {
    editSettings(() => {});
    done.push(`our hooks removed from ${settingsPath}`);
  }
}
console.log(`activate ${mode}:\n` + (done.length ? done.map((d) => '  ' + d).join('\n') : '  nothing to change')
  + (warn.length ? '\nwarnings:\n' + warn.map((w) => '  ' + w).join('\n') : ''));
