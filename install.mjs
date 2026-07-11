#!/usr/bin/env node
/**
 * Bark Notify — One-Click Installer
 * Cross-platform: macOS / Linux / Windows
 *
 * Usage:
 *   node install.mjs
 *
 * What it does:
 *   1. Prompt for your Bark device key
 *   2. Copy notify-bark.mjs → ~/.claude-to-im/
 *   3. Add Stop hook to ~/.claude/settings.json (safe merge)
 *   4. Optionally install skill to ~/.claude/skills/bark-notify/
 *   5. Send a test notification
 */

import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  existsSync,
  mkdirSync,
  copyFileSync,
  readFileSync,
  writeFileSync,
  chmodSync,
} from 'node:fs';
import { createInterface } from 'node:readline';

// ── Paths ───────────────────────────────────────────────────────────
const HOME = homedir();
const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT_SRC = join(__dirname, 'notify-bark.mjs');
const SKILL_SRC = join(__dirname, 'SKILL.md');
const BARK_SKILL_DIR = join(HOME, '.bark-skill');
const SCRIPT_DEST = join(BARK_SKILL_DIR, 'notify-bark.mjs');
const SETTINGS_PATH = join(HOME, '.claude', 'settings.json');
const SKILL_DIR = join(HOME, '.claude', 'skills', 'bark-notify');
const SKILL_DEST = join(SKILL_DIR, 'SKILL.md');
const WINDOWS_NOTIFY_SRC = join(__dirname, 'notify-windows.mjs');
const WINDOWS_NOTIFY_DEST = join(BARK_SKILL_DIR, 'notify-windows.mjs');

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

// ── Helpers ─────────────────────────────────────────────────────────
function log(msg) {
  console.log(`  ${msg}`);
}

function success(msg) {
  console.log(`${GREEN}✔${RESET} ${msg}`);
}

function warn(msg) {
  console.log(`${YELLOW}⚠${RESET} ${msg}`);
}

function error(msg) {
  console.error(`${RED}✘${RESET} ${msg}`);
}

function heading(msg) {
  console.log(`\n${BOLD}${CYAN}▸ ${msg}${RESET}\n`);
}

function ask(question) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(`  ${question}: `, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// ── Steps ───────────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log(`  ${BOLD}🛎️  Bark Notify — Installer${RESET}`);
  console.log(`  ${CYAN}https://gitee.com/secondwatch/Bark-skill${RESET}`);
  console.log('');

  // ── Step 1: Get Bark key ──────────────────────────────────────
  heading('Step 1: Bark Device Key');
  console.log('  Get your key from the Bark iOS app:');
  console.log('  Open Bark → find URL like https://api.day.app/<YOUR_KEY>');
  console.log('  The key is the random string after the last "/"');
  console.log('');

  let barkKey = process.env.BARK_KEY || '';
  if (barkKey) {
    log(`Using BARK_KEY from environment: ${barkKey.slice(0, 4)}****`);
  } else {
    barkKey = await ask('Paste your Bark key');
    if (!barkKey) {
      error('Bark key is required. Run this script again with your key.');
      process.exit(1);
    }
  }

  // ── Step 2: Copy the notification script ──────────────────────
  heading('Step 2: Install notification script');

  if (!existsSync(SCRIPT_SRC)) {
    error(`Source script not found: ${SCRIPT_SRC}`);
    error('Make sure you run this from the bark-skill directory.');
    process.exit(1);
  }

  mkdirSync(BARK_SKILL_DIR, { recursive: true });
  copyFileSync(SCRIPT_SRC, SCRIPT_DEST);

  // Make executable on Unix
  try {
    chmodSync(SCRIPT_DEST, 0o755);
  } catch {
    // Windows — chmod is a no-op, ignore
  }
  success(`Copied → ${SCRIPT_DEST}`);

  // Copy Windows notification helper (no chmod needed)
  if (existsSync(WINDOWS_NOTIFY_SRC)) {
    copyFileSync(WINDOWS_NOTIFY_SRC, WINDOWS_NOTIFY_DEST);
    success(`Copied → ${WINDOWS_NOTIFY_DEST}`);
  } else {
    warn(`Windows notify helper not found: ${WINDOWS_NOTIFY_SRC} — skipping`);
  }

  // ── Step 3: Configure the Stop hook ──────────────────────────
  heading('Step 3: Configure Stop hook');

  // Stop hooks do NOT support "matcher" — that field is UserPromptSubmit-only.
  // Including it causes "JSON validation failed" in Claude Code's hook engine.
  const hookEntry = {
    hooks: [
      {
        type: 'command',
        command: `node "${SCRIPT_DEST}" --key ${barkKey}`,
        async: true,
        timeout: 10,
      },
    ],
  };

  let settings = {};
  if (existsSync(SETTINGS_PATH)) {
    try {
      const raw = readFileSync(SETTINGS_PATH, 'utf-8');
      settings = JSON.parse(raw);
      log(`Found existing settings.json`);
    } catch (e) {
      warn(`Could not parse settings.json — will create a new one`);
      settings = {};
    }
  } else {
    log('No existing settings.json — will create one');
    mkdirSync(join(HOME, '.claude'), { recursive: true });
  }

  // Merge the Stop hook safely
  if (!settings.hooks) {
    settings.hooks = {};
  }
  if (!settings.hooks.Stop) {
    settings.hooks.Stop = [];
  }

  // Check if bark hook already exists
  const alreadyExists = settings.hooks.Stop.some(
    (entry) =>
      entry.hooks &&
      entry.hooks.some(
        (h) => h.command && h.command.includes('notify-bark.mjs'),
      ),
  );

  if (alreadyExists) {
    warn('Bark Stop hook already exists in settings.json — skipped');
  } else {
    settings.hooks.Stop.push(hookEntry);
    writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2) + '\n');
    success(`Stop hook added → ${SETTINGS_PATH}`);
  }

  // ── Step 4: Install skill (optional) ──────────────────────────
  heading('Step 4: Install Claude Code skill (optional)');

  const installSkill = await ask('Install /bark-notify skill? (Y/n)');
  if (installSkill.toLowerCase() !== 'n') {
    if (existsSync(SKILL_DEST)) {
      warn('Skill already installed — skipped');
    } else {
      mkdirSync(SKILL_DIR, { recursive: true });
      copyFileSync(SKILL_SRC, SKILL_DEST);
      success(`Skill installed → ${SKILL_DEST}`);
      log('You can now use /bark-notify setup in Claude Code');
    }
  } else {
    log('Skipped skill installation');
  }

  // ── Step 5: Test notification ────────────────────────────────
  heading('Step 5: Test notification');

  const doTest = await ask('Send a test notification? (Y/n)');
  if (doTest.toLowerCase() !== 'n') {
    const title = 'Claude Code 🛎️';
    const body = 'Bark notification is working!';
    const barkUrl = `https://api.day.app/${barkKey}`;
    const url = `${barkUrl}/${encodeURIComponent(title)}/${encodeURIComponent(body)}?sound=default`;

    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(10_000),
      });
      const json = await res.json();
      if (json.code === 200) {
        success('Test notification sent! Check your iPhone 📱');
      } else {
        warn(`Bark API returned: ${JSON.stringify(json)}`);
        warn('Check your key and try again.');
      }

      // Also test Windows toast + sound
      try {
        const winNotify = await import('./notify-windows.mjs');
        winNotify.playSound();
        winNotify.showToast(title, body);
        success('Windows toast + sound test sent (check your desktop)');
      } catch {
        // notify-windows.mjs not available — skip
      }
    } catch (err) {
      warn(`Could not send test notification: ${err.message}`);
      warn('You can test manually:');
      warn(`  curl "${url}"`);
    }
  }

  // ── Done ───────────────────────────────────────────────────────
  console.log('');
  console.log(`  ${GREEN}${BOLD}✅ Installation complete!${RESET}`);
  console.log('');
  console.log(`  ${BOLD}What happens next:${RESET}`);
  console.log(`  Each time Claude Code finishes a task, your iPhone will buzz.`);
  console.log(`  On Windows: a desktop toast notification + sound plays automatically.`);
  console.log(`  No extra config needed — it just works.`);
  console.log('');
  console.log(`  ${BOLD}Set BARK_KEY in your shell profile (optional):${RESET}`);
  console.log(`  Add this to your shell rc file:`);
  console.log(`    export BARK_KEY=${barkKey}`);
  console.log('');
  console.log(`  ${BOLD}Troubleshooting:${RESET}`);
  console.log(`    node ${SCRIPT_DEST}`);
  console.log('');
}

main().catch((err) => {
  error(`Unexpected error: ${err.message}`);
  process.exit(1);
});
