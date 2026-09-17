# Install the "x-md-paste" skill (Claude Code and other agents that read
# ~/.claude/skills) on Windows.
#
#   irm https://xmdpaste.icy-cat.com/skill.ps1 | iex
#
# Writes SKILL.md and xmdpaste.mjs into %USERPROFILE%\.claude\skills\x-md-paste\ and
# touches nothing else. Re-running it overwrites those files (that is how you update).
# Overrides: CLAUDE_SKILLS_DIR (target skills dir), XMDPASTE_SKILL_BASE (source).
# Uses "return", never "exit": under "| iex" exit would close the user's window.
& {
  $ErrorActionPreference = 'Stop'
  # Windows PowerShell 5.1 may still default to TLS 1.0, which the site refuses.
  [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

  $base = if ($env:XMDPASTE_SKILL_BASE) { $env:XMDPASTE_SKILL_BASE } else { 'https://xmdpaste.icy-cat.com/skill' }
  $root = if ($env:CLAUDE_SKILLS_DIR) { $env:CLAUDE_SKILLS_DIR } else { Join-Path $HOME '.claude\skills' }
  $dir = Join-Path $root 'x-md-paste'

  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host 'Node.js 20 or newer is required: https://nodejs.org' -ForegroundColor Red
    return
  }
  $major = [int](node -p "process.versions.node.split('.')[0]")
  if ($major -lt 20) {
    Write-Host "Node.js $major found; 20 or newer is required: https://nodejs.org" -ForegroundColor Red
    return
  }

  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  foreach ($f in @('SKILL.md', 'xmdpaste.mjs')) {
    $part = Join-Path $dir "$f.part"
    Invoke-WebRequest -UseBasicParsing -Uri "$base/$f" -OutFile $part
    Move-Item -Force -Path $part -Destination (Join-Path $dir $f)
  }

  Write-Host "installed -> $dir"
  Write-Host ''
  Write-Host 'Say to your AI assistant:  post this to X as an article'
  Write-Host 'Needs the X Article Markdown Paste extension 1.4.0+ in your browser, signed in to x.com.'
}
