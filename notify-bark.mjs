#!/usr/bin/env node
/**
 * Claude Code task notification via Bark (iOS push).
 */

// Stop hook: suppress ALL output. Any stdout/stderr = JSON validation failure.
process.on('unhandledRejection', () => process.exit(0));
process.on('uncaughtException', () => process.exit(0));

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
  // Silent fail — don't write anything to stdout/stderr.
  // Claude Code Stop hook validates ALL output streams as JSON.
  process.exit(0);
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
  body = '✅ Claude Code 任务执行完毕';

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

// Send Bark notification (fire-and-forget, no output)
try {
  const url = `${BARK_URL}/${encodeURIComponent(title)}/${encodeURIComponent(body)}?sound=default`;
  await fetch(url, { signal: AbortSignal.timeout(10_000) });
} catch (_) {
  // Network errors: silent.
  // Claude Code Stop hook validates ALL stdout/stderr as JSON.
  // Any output = risk of "JSON validation failed".
}

// Stop hook stdout is validated as JSON by Claude Code's hook engine.
// Empty string is NOT valid JSON — causes "JSON validation failed".
// Must output valid JSON to satisfy the parser.
process.stdout.write(JSON.stringify({status: "ok"}) + "\n");
process.exit(0);
