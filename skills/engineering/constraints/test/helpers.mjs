// Throwaway git repos for the script tests. Each repo gets a copy of ../scripts in scripts/, the
// way setup installs them, so a script finds floor-guard.config.json beside itself.
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPTS = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts');

export function makeRepo({ config } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'dili-bar-'));
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim();
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'test@example.test');
  git('config', 'user.name', 'Test');
  cpSync(SCRIPTS, join(dir, 'scripts'), { recursive: true });
  if (config) writeFileSync(join(dir, 'scripts', 'floor-guard.config.json'), JSON.stringify(config));
  writeFileSync(join(dir, '.gitignore'), 'node_modules/\n');
  const write = (path, text) => {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  };
  const commit = (msg = 'c') => { git('add', '-A'); git('commit', '-q', '-m', msg); };
  // Runs a node script from the repo's scripts/ and returns { status, stdout, stderr }.
  const node = (script, args = [], opts = {}) => {
    const r = spawnSync(process.execPath, [join(dir, 'scripts', script), ...args],
      { cwd: opts.cwd ?? dir, encoding: 'utf8', input: opts.input, env: { ...process.env, ...opts.env } });
    return { status: r.status, stdout: r.stdout, stderr: r.stderr };
  };
  return { dir, git, write, commit, node };
}
