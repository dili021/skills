#!/usr/bin/env node
// Claude Code PreToolUse hook on Bash: refuses commands that skip the git hooks, so an agent cannot
// merge past the bar. A person can still skip them from their own terminal. Exit 2 blocks the call
// and shows the reason to the agent.
import { readFileSync } from 'node:fs';

let input;
try { input = JSON.parse(readFileSync(0, 'utf8')); } catch { process.exit(0); }
if (input.tool_name !== 'Bash') process.exit(0);
const command = String(input.tool_input?.command ?? '');
// A quoted commit message can hold " -n "; blank quoted text out before looking for that flag.
const unquoted = command.replace(/"(\\.|[^"\\])*"|'[^']*'/g, '""');

// Git config keys are case-insensitive, so the hooksPath patterns are too.
const SKIPS = [
  [/(^|\s)--no-verify(\s|=|$)/, '--no-verify'],
  [/\bgit\b[^\n;&|]*\bcommit\b[^\n;&|]*\s-[A-Za-z]*n[A-Za-z]*(\s|$)/, 'git commit -n', unquoted],
  [/\s-c\s+["']?core\.hookspath=/i, 'a one-off core.hooksPath'],
  [/\bgit\b[^\n;&|]*\bconfig\b[^\n;&|]*(--unset(-all)?|\bunset)\s+(--\S+\s+)*core\.hookspath\b/i, 'unsetting core.hooksPath'],
  [/\bgit\b[^\n;&|]*\bconfig\b(?![^\n;&|]*(--get|\bget\b))[^\n;&|]*\bcore\.hookspath\s+[^\s;&|]/i, 'changing core.hooksPath'],
];
for (const [re, what, text = command] of SKIPS) {
  if (re.test(text)) {
    console.error(`Blocked: ${what} skips the git hooks that run the bar. Fix what the hook reports; a person decides when to skip it.`);
    process.exit(2);
  }
}
