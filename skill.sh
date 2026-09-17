#!/bin/sh
# Install the "x-md-paste" skill (Claude Code and other agents that read
# ~/.claude/skills).
#
#   curl -fsSL https://xmdpaste.icy-cat.com/skill.sh | sh
#
# Writes SKILL.md and xmdpaste.mjs into ~/.claude/skills/x-md-paste/ and touches
# nothing else. No dependencies: the CLI uses only Node's own modules.
# Re-running it overwrites those files, which is how you update.
# Overrides: CLAUDE_SKILLS_DIR (target skills dir), XMDPASTE_SKILL_BASE (source).
set -eu

BASE="${XMDPASTE_SKILL_BASE:-https://xmdpaste.icy-cat.com/skill}"
DIR="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}/x-md-paste"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 20 or newer is required: https://nodejs.org" >&2
  exit 1
fi
MAJOR=$(node -p "process.versions.node.split('.')[0]")
if [ "$MAJOR" -lt 20 ]; then
  echo "Node.js $MAJOR found; 20 or newer is required: https://nodejs.org" >&2
  exit 1
fi

mkdir -p "$DIR"
for f in SKILL.md xmdpaste.mjs; do
  curl -fsSL "$BASE/$f" -o "$DIR/$f.part"
  mv "$DIR/$f.part" "$DIR/$f"
done

echo "installed → $DIR"
echo
echo "Say to your AI assistant:  把这篇发到 X 长文  /  post this to X as an article"
echo "Needs the X Article Markdown Paste extension 1.4.0+ in your browser, signed in to x.com."
