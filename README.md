# Bark Skill for Claude Code

> 🛎️ Push Claude Code task-completion notifications to your iPhone via [Bark](https://github.com/Finb/Bark).
>
> 让 Claude Code 在任务执行完毕后自动推送通知到你的 iPhone。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Demo

When Claude Code finishes a session, your iPhone gets:

```
┌─────────────────────────────┐
│  Claude a1b2c3d4 14:35     │
│  Fixed the login bug by     │
│  updating the auth middleware│
│  and adding session token... │
└─────────────────────────────┘
```

No more sitting around waiting — get notified the moment Claude is done.

不用再盯着屏幕等 Claude 跑完 — 任务完成，手机秒收通知，闭环拉满。

## Requirements

- [Claude Code](https://claude.ai/code) (latest version)
- [Bark](https://apps.apple.com/app/bark/id1403753865) iOS app installed on your iPhone
- Node.js 18+ (for ESM support, `fetch` built-in)

## Quick Start (1 min)

### One-click install (macOS / Linux / Windows)

```bash
git clone https://gitee.com/secondwatch/Bark-skill
cd Bark-skill
node install.mjs
```

The installer will:
1. Ask for your Bark key
2. Copy the script to `~/.claude-to-im/`
3. Add the Stop hook to `~/.claude/settings.json`
4. Install the `/bark-notify` skill
5. Send a test notification

**Done.** Each time Claude Code finishes, your iPhone buzzes. 📱

### Manual install

<details>
<summary>Click to expand manual steps</summary>

#### Step 1: Get your Bark key

1. Install [Bark](https://apps.apple.com/app/bark/id1403753865) on your iPhone
2. Open Bark → copy your device key from the URL shown
3. It looks like: `https://api.day.app/AbCdEf123456` — the key is `AbCdEf123456`

#### Step 2: Install the script

```bash
cp notify-bark.mjs ~/.claude-to-im/notify-bark.mjs
chmod +x ~/.claude-to-im/notify-bark.mjs
```

#### Step 3: Add the Stop hook

Add this to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "Stop": [{
      "matcher": ".*",
      "hooks": [{
        "type": "command",
        "command": "node \"~/.claude-to-im/notify-bark.mjs\" --key your_key_here",
        "async": true,
        "timeout": 10
      }]
    }]
  }
}
```

> ⚠️ If `hooks` already exists, **merge** the `Stop` entry — don't duplicate `hooks`.

#### Step 4: Test

```bash
node ~/.claude-to-im/notify-bark.mjs --key your_key
```

</details>

## How It Works

```
┌──────────────────┐
│  Claude session  │
│      ends        │
│   (Stop hook)    │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ notify-bark.mjs  │
│                  │
│ 1. Find latest   │
│    transcript    │
│    (.jsonl)      │
│ 2. Extract last  │
│    assistant msg │
│ 3. Summarize     │
│    (200 chars)   │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  api.day.app     │   Bark Cloud Push
│  POST /<key>/    │ ──────────────────►  iPhone 📱
│  <title>/<body>  │
└──────────────────┘
```

## Configuration

### `--key` flag (recommended for hooks)

```json
"command": "node \"~/.claude-to-im/notify-bark.mjs\" --key your_bark_key"
```

This works on macOS, Linux, and Windows — no shell-specific syntax.

### Environment variable

Add to `~/.zshrc` (macOS/Linux) or set in System Environment Variables (Windows):

```bash
export BARK_KEY=your_bark_key
```

Then the hook command is simply:

```json
"command": "node ~/.claude-to-im/notify-bark.mjs"
```

### Custom Bark server (self-hosted)

```bash
export BARK_URL=https://your-bark-server.com
```

## Advanced

### Custom notification title/body

```bash
# Via CLI flags
node notify-bark.mjs --key xxx --title "🎉 Build Done" --body "All tests passed"

# Or: first positional arg = body (legacy)
node notify-bark.mjs --key xxx "All tests passed"
```

> Note: When `--title` or `--body` is passed, the script skips transcript scanning.

### Pair with specific projects

Use the `matcher` field in the hook to only fire for certain project directories:

```json
{
  "matcher": "/Users/me/work-project",
  "hooks": [...]
}
```

### Skip notification for quick sessions

You can conditionally skip by checking session duration — left as an exercise for advanced users.

## Troubleshooting

| Symptom | Check |
|---------|-------|
| No notification | Run script manually — if it works, the hook may be misconfigured |
| `BARK_KEY` missing | Set env var or pass inline in hook command |
| Wrong session content | Script always reads the most recently modified transcript |
| Bark not receiving | Check iPhone notification settings; test via `https://api.day.app/<key>/test` in browser |

## FAQ

**Q: Does this cost money?**
A: No. Bark is free and uses Apple's push notification service.

**Q: Is my data safe?**
A: The script only sends the notification title and a 200-char summary to Bark's API. Your code, files, and full conversation never leave your machine except for that summary. If you're extra cautious, self-host a [Bark server](https://github.com/Finb/Bark).

**Q: Can I use this with other Claude Code forks?**
A: Yes, as long as the fork uses the same `~/.claude/projects/<id>.jsonl` transcript format and supports Stop hooks.

**Q: Does it work on Android?**
A: Bark is iOS-only. For Android, consider [Pushover](https://pushover.net/) or similar services — the script architecture is easy to adapt.

## Contributing

Issues and PRs welcome! The codebase is intentionally minimal — keep it that way.

## Credits

- [Bark](https://github.com/Finb/Bark) by [Finb](https://github.com/Finb) — the excellent open-source iOS push tool
- [Claude Code](https://claude.ai/code) — AI coding assistant by Anthropic

## License

MIT — see [LICENSE](LICENSE) file.
