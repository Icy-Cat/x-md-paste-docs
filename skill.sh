#!/bin/sh
# Install the "x-md-paste" skill for Claude Code.
#
#   curl -fsSL https://xmdpaste.icy-cat.com/skill.sh | sh
#
# Writes two files into ~/.claude/skills/x-md-paste/ and touches nothing
# else. No dependencies: the CLI it installs uses only Node's own modules.
# Re-running it overwrites those two files, which is how you update.
set -eu

DIR="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}/x-md-paste"

if ! command -v node >/dev/null 2>&1; then
  echo "node is required (20 or newer): https://nodejs.org" >&2
  exit 1
fi

mkdir -p "$DIR"
for f in SKILL.md xmdpaste.mjs; do
  curl -fsSL "https://xmdpaste.icy-cat.com/skill/$f" -o "$DIR/$f.part"
  mv "$DIR/$f.part" "$DIR/$f"
done

echo "installed → $DIR"
echo
echo "Say to Claude Code:  把这篇发到 X 长文"
echo "It needs the X Article Markdown Paste browser extension installed and"
echo "x.com signed in, in your default browser."
