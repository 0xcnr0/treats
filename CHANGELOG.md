# Changelog

## v0.3.0 — It makes Claude actually code better

Treats stops being only a toy and starts improving real outcomes:

- **Auto-treats from real results.** A new PostToolUse hook watches when Claude
  runs your tests / linter / build. A clean pass earns a treat automatically
  (rate-limited per project). Failures are ignored by default (a red test
  mid-dev is normal); turn on `autoScold` to make failures cost a treat and nudge
  Claude to fix them.
- **Good-habit skills.** Ships `plan-first`, `test-first` and `self-review`
  skills the AI can auto-invoke, framing better engineering as the way to earn
  treats.
- **Per-project scoring** (from the previous drop) means these rewards land on
  the right project.

## v0.2.0 — The desktop pet

The headline interaction is no longer typing commands — it's a little animal that
lives in your screen corner and that you **pet with your mouse**.

- **Mouse-pettable desktop pet** — click/stroke to treat, right-click to scold,
  press-and-drag to move (the position is remembered between launches).
- **It's alive** — a synthesized per-animal voice ("Woof! / Meow! / Rawr! /
  Neigh! / Squeak! / Squawk!") and a speech bubble on a treat, a soft whimper on a
  scolding, idle wiggles, a content wag when doing well, a droop in the doghouse,
  and it falls asleep 💤 when you're idle (waking on any interaction).
- **One source of truth** — the pet animates off the score, so a mouse pat, a
  hotkey, the CLI and slash commands all look identical.
- **Hotkeys** ⌘⇧G / Ctrl+Shift+G (treat) and ⌘⇧B / Ctrl+Shift+B (scold) still work
  from anywhere.
- Website reframed pet-first with a clickable demo pet (it speaks too), copy
  buttons, and a two-path install (pet vs. plugin).

## v0.1.0 — Treats

- School/pet **token economy** for Claude Code: reward good work, scold the bad,
  and the feedback is injected back into Claude's context via hooks so it adjusts.
- **Claude Code plugin** + slash commands: `/plugin install treats`, then
  `/treats:good` · `/treats:bad` · `/treats:status` · `/treats:report` ·
  `/treats:animal` · `/treats:statusline`.
- **Pick your animal** — dog/cat/dragon/horse/hamster/parrot, each with its own
  ranks, emoji and phrasing.
- **Walking status-line animal**, ranks, an "Obedience" score, report cards,
  weekly report scheduling.
- Zero-dependency CLI; cross-platform sounds (macOS/Windows/Linux).
