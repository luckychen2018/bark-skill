import { spawn } from 'node:child_process';

function isWindows() {
  return process.platform === 'win32';
}

function spawnSilent(cmd, args) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      stdio: 'ignore',
    });
    child.on('error', () => resolve());
    child.on('close', () => resolve());
  });
}

function spawnDetached(cmd, args) {
  try {
    const child = spawn(cmd, args, {
      stdio: 'ignore',
      detached: true,
    });
    child.unref();
  } catch {
    // silent fail
  }
}

// Escape text for PowerShell single-quoted strings.
// Single quotes are the only special character: '' → literal '
function esc(s) {
  return s.replace(/'/g, "''");
}

export async function playSound() {
  if (!isWindows()) return;
  try {
    await spawnSilent('powershell', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      '[System.Media.SystemSounds]::Asterisk.Play()',
    ]);
  } catch {
    // silent fail
  }
}

export async function showToast(title, body) {
  if (!isWindows()) return;
  try {
    const script = [
      "[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null",
      "$template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)",
      "$textNodes = $template.GetElementsByTagName('text')",
      `$textNodes.Item(0).AppendChild($template.CreateTextNode('${esc(title)}')) > $null`,
      `$textNodes.Item(1).AppendChild($template.CreateTextNode('${esc(body)}')) > $null`,
      "$toast = [Windows.UI.Notifications.ToastNotification]::new($template)",
      "[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('Claude Code').Show($toast)",
    ].join('; ');

    // Detached + sleep: toast needs process alive briefly to render
    const sleepScript = script + '; Start-Sleep -Seconds 3';
    spawnDetached('powershell', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      sleepScript,
    ]);
  } catch {
    // silent fail
  }
}
