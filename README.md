# 🦴 Treats

[![Website](https://img.shields.io/badge/website-treats-ffcf4d)](https://treats-ai.vercel.app)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Platform](https://img.shields.io/badge/CLI-macOS%20%C2%B7%20Windows%20%C2%B7%20Linux-black)

> **Train Claude Code like a puppy.** Give it a treat 🦴 for good work, a "bad dog" 🚫
> when it slips — and it actually behaves better next time.
>
> **Live demo → [the website](https://treats-ai.vercel.app)**

## What is this?

[Claude Code](https://www.npmjs.com/package/@anthropic-ai/claude-code) is an AI
assistant that writes code for you in the terminal. Sometimes it's brilliant;
sometimes it gets lazy (skips tests, rambles, ignores errors).

**Treats** is a tiny tool that sits on top of it. You reward good work and scold
bad work — and the magic part: **your feedback is fed back into Claude's
context**, so it remembers and adjusts.

- Give a treat → Claude's score goes up.
- Bad dog → score goes down (low enough and it's in the "doghouse").
- Every time you talk to Claude, it quietly sees its score and what you scolded
  it for. Scold it for "no tests" → its next reply knows `repeated reason: tests`
  → it writes the tests.

A "treat" isn't money or crypto — it's just a **point**, like a gold star in a
notebook. You're the trainer; Claude is the puppy.

Inspired by the viral whip/wand overlays (**BadClaude / OpenWhip** and
**GoodClaude**) — but those were pure theater; Claude never knew it got smacked.
Treats closes the loop: the feedback actually reaches Claude.

## Install (the easy way — Claude Code plugin)

In any Claude Code session, run two lines, once:

```
/plugin marketplace add 0xcnr0/treats
/plugin install treats
```

That's it. You instantly get the slash commands below, the feedback hooks are
wired automatically (so your reactions reach Claude on its next reply), and you
can turn on the walking status line. **No clone, no npm, no terminal switching.**

## Use it — right inside the session

```
/treats:good wrote thorough tests and kept it concise
/treats:bad  skipped the edge cases
/treats:status            # treats, rank, last thing it did
/treats:report            # training report card
/treats:undo              # take back the last one (misclick)
/treats:animal cat        # change your animal (dog/cat/dragon/horse/hamster/parrot)
/treats:statusline        # show your animal walking in the status bar
```

One line, no leaving the prompt. Reward what you like, scold what you don't —
Claude sees its running score and recent feedback on the very next message.

## Manual install (from source — needed only for the menu-bar overlay)

```bash
git clone https://github.com/0xcnr0/treats
cd treats
npm install
node packages/core/bin/treats.js install   # hooks + /treats:* commands + status line
npm run overlay                             # optional menu-bar app (macOS)
```

`treats install` is a one-shot that wires the hooks, drops the `/treats:*` slash
commands into `~/.claude/commands/` (so they work in every session without the
plugin), and turns on the walking status line. You also get a global `treats`
CLI and the overlay with global hotkeys (⌘⇧G / Ctrl+Shift+G to treat, ⌘⇧B /
Ctrl+Shift+B to scold).

## Pick your animal 🐶🐱🐉🐴🐹🦜

Your AI doesn't have to be a dog. `/treats:animal cat` and the whole thing
re-themes — emojis, ranks and phrasing follow. A cat climbs from *Fine Feline*
to *Top Cat* (or lands at the *Spray Bottle*); a dragon grows its hoard from
*Hatchling* to *Elder Wyrm*. Try them live on the [website](https://treats-ai.vercel.app).

## Pick your animal 🐶🐱🐉🐴🐹🦜

Your AI doesn't have to be a dog. `treats animal cat` and the whole thing
re-themes — emojis, ranks and phrasing follow. A cat climbs from *Fine Feline*
to *Top Cat* (or lands at the *Spray Bottle*); a dragon grows its hoard from
*Hatchling* to *Elder Wyrm*. Try them live on the [website](https://treats-ai.vercel.app).

## How it actually works (the feedback loop)

`treats install-hooks` adds three [Claude Code hooks](https://docs.anthropic.com/en/docs/claude-code/hooks)
to `~/.claude/settings.json` (backing it up first, keeping anything you already had):

- **SessionStart** — when a session begins, injects your current standing
  (treats, rank, last few notes, and a behavioral nudge) into Claude's context.
- **UserPromptSubmit** — re-injects *only when the score changed* since last time,
  so a mid-session scolding reaches Claude on its next reply without spamming it
  every message.
- **Stop** — remembers which task just finished, so the next `good`/`bad` is
  attributed to it.

What Claude receives looks like this (capped at ~450 chars):

```
[Treats] -2 treat(s) — Rank: Needs Training. Recent feedback:
✗ "skipped writing tests" (2h) | ✗ "too verbose" (1d) | ✓ "great refactor" (1d)
You've been a bad dog on 3 of the last 5 tasks; repeated reason: tests. Shape up to earn treats.
```

Everything lives in `~/.treats/` on your own machine — no accounts, no servers.

## The menu-bar app

```bash
npm run overlay
```

Your animal's treat icon appears in your menu bar with the current score.
Global shortcuts (Electron maps `CommandOrControl`, so they work cross-platform):

- **⌘⇧G** (Mac) / **Ctrl+Shift+G** (Windows·Linux) — give a treat (sparkle + chime, +1)
- **⌘⇧B** (Mac) / **Ctrl+Shift+B** (Windows·Linux) — bad dog (whip-crack + red flash, -1)

> The CLI, hooks and sounds run on macOS, Windows and Linux. The menu-bar app is
> developed on macOS first; it should run elsewhere via Electron, but the tray
> text and the optional "type into terminal" feature are macOS-tuned.

The overlay is fully click-through (keep working underneath it). The tray menu
switches modes, toggles visibility, and toggles **“type a message into the
terminal”** (default **off** — needs macOS Accessibility permission; keystrokes
go to whatever app is focused, so it only types into Claude Code when its
terminal is in front).

## Ranks

| Treats | Rank |
|---|---|
| 20+ | 🏆 Best Boy |
| 10+ | 🌟 Very Good Boy |
| 5+ | ⭐ Good Boy |
| 0+ | 🐶 Good Pup |
| -1 … -4 | ⚠️ Needs Training |
| -5 or less | 🚫 Bad Dog |
| -10 or less | ⛔ Doghouse |

## Your animal in the status bar 🐶

Want to see your pet *inside* every Claude Code session? Install the status line:

```bash
npm run install-statusline       # adds it to ~/.claude/settings.json (backs up first)
```

Your animal then walks along the bottom status bar of the terminal Claude Code,
showing its treat count, rank, and the session's context usage — refreshed every
second, so it actually strolls back and forth:

```
🦴 ··🐶··  +3 treats · 🐶 Good Pup · ctx 18%
```

> This is the one spot a third-party tool can paint inside a Claude Code session
> (the terminal's status line). The mascot in the corner of the desktop/Antigravity
> GUI is Anthropic's own UI — there's no public hook to add ours there.

## Weekly report cards

```bash
npm run install-schedule                       # Mondays 09:00 (macOS launchd)
node scripts/install-schedule.js --uninstall   # remove it
```

Cards land in `~/.treats/reports/report-YYYY-MM-DD.md`.

## See the whole loop

```bash
npm run demo
```

Walks through reward → scold → what Claude sees → mid-session update → undo →
report card, end to end.

## Project layout

| Path | What |
|---|---|
| `packages/core/src/ledger.js` | atomic score file read/append (the foundation) |
| `packages/core/bin/treats.js` | the `treats` CLI |
| `packages/core/src/hooks.js` + `context.js` | hook adapters + the note Claude reads |
| `packages/overlay/main.js` | menu-bar app + click-through overlay |
| `scripts/` | asset generators, hook/schedule installers, demo |

## Uninstall hooks

Restore the timestamped backup that `install-hooks` printed:

```bash
cp ~/.claude/settings.json.backup.<timestamp> ~/.claude/settings.json
```

## License

MIT — see [LICENSE](LICENSE). Not affiliated with Anthropic. The "bad dog" bit is
a playful way to give an AI feedback; be kind to real humans and real dogs. 🐶
