#!/usr/bin/env node
/**
 * Claude Code task notification via Bark (iOS push).
 * Extracts the last assistant message from the session transcript
 * and sends it as a push notification to your iPhone.
 *
 * Usage:
 *   BARK_KEY=your_key node notify-bark.mjs
 *
 * Or set BARK_KEY in your environment:
 *   export BARK_KEY=your_key
 *   node notify-bark.mjs
 *
 * GitHub: https://github.com/luckychen2018/bark-skill
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';

// ── Configuration ───────────────────────────────────────────────────
// Priority: CLI --key flag > BARK_KEY env var
function parseArgs(argv) {
  const args = { key: '', customTitle: '', customBody: '' };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--key' && argv[i + 1]) {
      args.key = argv[++i];
    } else if (argv[i] === '--title' && argv[i + 1]) {
      args.customTitle = argv[++i];
    } else if (argv[i] === '--body' && argv[i + 1]) {
      args.customBody = argv[++i];
    } else if (i === 2 && !argv[i].startsWith('--')) {
      // Legacy: first positional arg = custom body
      args.customBody = argv[i];
    }
  }
  return args;
}

const cliArgs = parseArgs(process.argv);
const BARK_KEY = cliArgs.key || process.env.BARK_KEY;

if (!BARK_KEY) {
  console.error('[notify-bark] Missing BARK_KEY.');
  console.error('  Usage:');
  console.error('    node notify-bark.mjs --key <your_bark_key>');
  console.error('    or: export BARK_KEY=your_key');
  process.exit(1);
}

const BARK_URL = process.env.BARK_URL || `https://api.day.app/${BARK_KEY}`;

// ── Find and read the most recent transcript ────────────────────────
function findLatestTranscript() {
  const projectsDir = resolve(homedir(), '.claude', 'projects');
  let latest = null;
  let latestTime = 0;

  try {
    const entries = readdirSync(projectsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dirPath = join(projectsDir, entry.name);
      try {
        const files = readdirSync(dirPath);
        for (const file of files) {
          if (!file.endsWith('.jsonl')) continue;
          const filePath = join(dirPath, file);
          const stat = statSync(filePath);
          if (stat.mtimeMs > latestTime) {
            latestTime = stat.mtimeMs;
            latest = filePath;
          }
        }
      } catch {
        // skip unreadable directories
      }
    }
  } catch {
    // projects dir may not exist yet
  }
  return latest;
}

function extractLastAssistantText(filePath) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n');
    // Search backwards for the last assistant text message
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const entry = JSON.parse(lines[i]);
        if (entry.type === 'assistant' && entry.message?.role === 'assistant') {
          const contents = entry.message.content || [];
          for (const c of contents) {
            if (c.type === 'text' && c.text) {
              return c.text;
            }
          }
        }
      } catch {
        // skip malformed lines
      }
    }
  } catch {
    // file may be unreadable
  }
  return null;
}

function summarize(text, maxLen = 200) {
  if (!text) return null;
  // Remove markdown headers and clean up
  const cleaned = text
    .replace(/^#+\s*/gm, '')
    .replace(/\n{2,}/g, '\n')
    .trim();
  if (cleaned.length <= maxLen) return cleaned;
  return cleaned.slice(0, maxLen) + '…';
}

// ── Main ────────────────────────────────────────────────────────────
let body, title;

// If custom title/body provided, use them directly (skip transcript scanning)
if (cliArgs.customTitle || cliArgs.customBody) {
  title = cliArgs.customTitle || 'Claude Code';
  body = cliArgs.customBody || 'Task completed';
} else {
  const transcriptPath = findLatestTranscript();
  body = '✅ Claude Code 任务执行完毕'; // ✅ Claude Code task completed

  let sessionId = '';
  if (transcriptPath) {
    // Extract session ID from filename: .../<sessionId>.jsonl
    const match = transcriptPath.match(/([a-f0-9-]{30,})\.jsonl$/);
    if (match) sessionId = match[1].slice(0, 8);

    const lastText = extractLastAssistantText(transcriptPath);
    const summary = summarize(lastText);
    if (summary) {
      body = summary;
    }
  }

  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  title = sessionId ? `Claude ${sessionId} ${time}` : `Claude Code ${time}`;
}

try {
  const url = `${BARK_URL}/${encodeURIComponent(title)}/${encodeURIComponent(body)}?sound=default`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  const json = await res.json();
  if (json.code === 200) {
    console.log(`[notify-bark] Sent OK (${body.length} chars)`);
  } else {
    console.error(`[notify-bark] Failed: ${JSON.stringify(json)}`);
    process.exit(1);
  }
} catch (err) {
  console.error(`[notify-bark] Error: ${err.message}`);
  process.exit(1);
}
