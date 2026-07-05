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

### One-click install (macOS / Linux / Windows)

```bash
git clone https://gitee.com/secondwatch/Bark-skill
cd Bark-skill
node install.mjs
```

安装脚本会引导你完成：输入 Bark Key → 复制脚本 → 配置 Hook → 安装 Skill → 发送测试通知。

### Manual install

<details>
<summary>手动安装步骤</summary>

#### 1. Get your Bark key

Install [Bark](https://apps.apple.com/app/bark/id1403753865) on your iPhone → copy device key.

在 iPhone 上安装 [Bark](https://apps.apple.com/app/bark/id1403753865)，复制设备 Key。

#### 2. Install the script

```bash
mkdir -p ~/.claude-to-im
cp notify-bark.mjs ~/.claude-to-im/notify-bark.mjs
```

#### 3. Add the Stop hook

```json
"hooks": {
  "Stop": [{
    "matcher": ".*",
    "hooks": [{
      "type": "command",
      "command": "node \"~/.claude-to-im/notify-bark.mjs\" --key your_key",
      "async": true,
      "timeout": 10
    }]
  }]
}
```

> ⚠️ Merge into existing `hooks`, don't duplicate.

#### 4. Test

```bash
node ~/.claude-to-im/notify-bark.mjs --key your_key
```

</details>

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
| `--key <key>` | Bark device key (CLI flag) | — |
| `BARK_KEY` | Bark device key (env var) | — |
| `BARK_URL` | Bark API endpoint | `https://api.day.app` |
| `--title <text>` | Custom notification title | Auto-generated |
| `--body <text>` | Custom notification body | Transcript summary |

Bark key sources (priority order):
1. `--key` CLI flag
2. `BARK_KEY` environment variable

## Troubleshooting

| Problem | Solution |
|---------|----------|
| No notification | Run script manually to test: `BARK_KEY=xxx node ~/.claude-to-im/notify-bark.mjs` |
| Wrong content | Script reads most recently modified transcript; ensure session finished |
| Duplicate notifications | One session exit = one notification. Manual tests also fire the hook |
| Bark not receiving | Check iPhone has Bark installed; verify key at `https://api.day.app/<key>` |
| `BARK_KEY` missing | Use `--key` flag or set env var |
| 未收到通知 | 手动运行 `node ~/.claude-to-im/notify-bark.mjs --key xxx` 测试 |
| 通知内容不对 | 脚本读取最近修改的 .jsonl 文件，确认目标会话已结束 |

## File Structure

```
bark-skill/
├── SKILL.md           # Claude Code skill definition
├── notify-bark.mjs    # Notification script (Node.js ESM)
├── install.mjs        # One-click cross-platform installer
├── README.md          # Project overview & docs
├── LICENSE            # MIT
└── .gitignore
```

## Credits

- [Bark](https://github.com/Finb/Bark) — iOS push notification tool
- [Claude Code](https://claude.ai/code) — AI coding assistant
