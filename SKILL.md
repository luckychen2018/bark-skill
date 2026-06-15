# Bark Notify Skill

Push Claude Code task-completion notifications to your iPhone via [Bark](https://github.com/Finb/Bark).

> Bark 是一款 iOS 推送工具，可以将自定义通知推送到你的 iPhone。本 Skill 让 Claude Code 在每次任务结束时自动推送通知。

## What it does

After every Claude Code session ends, this skill sends a push notification to your iPhone with:
- **Title**: `Claude <sessionID> HH:MM`
- **Body**: First 200 chars of Claude's last response (task summary)

当 Claude Code 会话结束时，自动推送通知到你的 iPhone：
- **标题**：`Claude <会话ID> <时间>`
- **正文**：Claude 最后一条回复的前 200 个字符（任务摘要）

## Quick Start

### 1. Get your Bark key

Install [Bark](https://apps.apple.com/app/bark/id1403753865) on your iPhone, open the app, copy your device key (a string like `AbCdEf123456`).

在 iPhone 上安装 [Bark](https://apps.apple.com/app/bark/id1403753865)，打开 App 复制你的设备 Key。

### 2. Install the script

```bash
# Copy the notification script to your Claude config directory
mkdir -p ~/.claude-to-im
cp notify-bark.mjs ~/.claude-to-im/notify-bark.mjs

# Set your Bark key as an environment variable
export BARK_KEY=your_bark_key_here
```

### 3. Add the Stop hook

Add to `~/.claude/settings.json`:

```json
"hooks": {
  "Stop": [{
    "matcher": "",
    "hooks": [{
      "type": "command",
      "command": "BARK_KEY=your_key node ~/.claude-to-im/notify-bark.mjs",
      "async": true,
      "timeout": 10
    }]
  }]
}
```

> ⚠️ If `hooks` already exists in your settings.json, **merge** into it — do NOT duplicate the key.

> ⚠️ 如果 settings.json 中已有 `hooks` 键，请**合并**而非重复添加。

### 4. Test it

```bash
BARK_KEY=your_key node ~/.claude-to-im/notify-bark.mjs
```

If everything works, your iPhone will receive a test notification.

运行测试命令，如果配置正确，你的 iPhone 会收到一条测试通知。

## How it works

```
Claude session ends (Stop hook)
  → node notify-bark.mjs runs
  → scans ~/.claude/projects/ for latest transcript (.jsonl)
  → extracts last assistant message (text type)
  → truncates to 200 chars
  → POSTs to https://api.day.app/<key>/<title>/<body>
  → iPhone receives push notification
```

## Configuration Reference

| Config | Description | Default |
|--------|-------------|---------|
| `BARK_KEY` | Your Bark device key (required) | — |
| `BARK_URL` | Bark API endpoint | `https://api.day.app` |

You can set `BARK_KEY` in:
- Environment variable: `export BARK_KEY=xxx`
- Hook command inline: `BARK_KEY=xxx node ~/.claude-to-im/notify-bark.mjs`
- Shell profile: add `export BARK_KEY=xxx` to `~/.zshrc` or `~/.bashrc`

## Troubleshooting

| Problem | Solution |
|---------|----------|
| No notification | Run script manually to test: `BARK_KEY=xxx node ~/.claude-to-im/notify-bark.mjs` |
| Wrong content | Script reads most recently modified transcript; ensure session finished |
| Duplicate notifications | One session exit = one notification. Manual tests also fire the hook |
| Bark not receiving | Check iPhone has Bark installed; verify key at `https://api.day.app/<key>` |
| `BARK_KEY` missing | Set env var or pass inline in the hook command |
| 未收到通知 | 手动运行脚本测试；检查 iPhone 上 Bark 通知权限 |
| 通知内容不对 | 脚本读取最近修改的 .jsonl 文件，确认目标会话已结束 |

## File Structure

```
bark-skill/
├── SKILL.md           # Claude Code skill definition
├── notify-bark.mjs    # Notification script (Node.js ESM)
├── README.md          # Project overview & docs
├── LICENSE            # MIT
└── .gitignore
```

## Credits

- [Bark](https://github.com/Finb/Bark) — iOS push notification tool
- [Claude Code](https://claude.ai/code) — AI coding assistant
