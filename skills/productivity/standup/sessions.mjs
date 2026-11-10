// Lists the Claude Code sessions active on one local day: folder, time, and the user's prompts.
// Usage: node sessions.mjs YYYY-MM-DD
import { createReadStream, readdirSync, statSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { homedir } from 'node:os';
import { join } from 'node:path';

// A closed pipe (`| head`) ends the run quietly.
process.stdout.on('error', (e) => process.exit(e.code === 'EPIPE' ? 0 : 1));

const day = process.argv[2];
if (!/^\d{4}-\d{2}-\d{2}$/.test(day ?? '')) {
  console.error('Usage: node sessions.mjs YYYY-MM-DD');
  process.exit(1);
}
const start = new Date(`${day}T00:00:00`);
const end = new Date(start.getTime() + 24 * 3600 * 1000);
const root = join(homedir(), '.claude', 'projects');

// Harness lines, not prompts: agent notifications, compaction, local command output.
const NOISE = /^(<task-notification>|<local-command|<command-name>\/compact<|This session is being continued)/;

const localTime =(d) => d.toTimeString().slice(0, 5);
const promptText = (content) => {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  if (content.some((b) => b.type === 'tool_result')) return '';
  return content.filter((b) => b.type === 'text').map((b) => b.text).join(' ');
};

for (const dir of readdirSync(root)) {
  let files;
  try {
    files = readdirSync(join(root, dir)).filter((f) => f.endsWith('.jsonl'));
  } catch {
    continue;
  }
  for (const f of files) {
    const path = join(root, dir, f);
    if (statSync(path).mtime < start) continue;
    const prompts = [];
    let cwd = '';
    const lines = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
    for await (const line of lines) {
      if (!line.includes('"type":"user"')) continue;
      let e;
      try {
        e = JSON.parse(line);
      } catch {
        continue;
      }
      if (e.type !== 'user' || e.isSidechain || e.isMeta) continue;
      const t = new Date(e.timestamp);
      if (t < start || t >= end) continue;
      const text = promptText(e.message?.content).replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '').replace(/\s+/g, ' ').trim();
      if (!text || NOISE.test(text)) continue;
      cwd ||= e.cwd ?? '';
      prompts.push(`  ${localTime(t)} ${text.slice(0, 200)}`);
    }
    if (prompts.length) console.log(`## ${cwd || dir} (${f.slice(0, 8)})\n${prompts.join('\n')}\n`);
  }
}
