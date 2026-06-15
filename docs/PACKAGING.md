# Packaging the pet as a double-click app

Today the pet runs via `npm run pet` (needs a terminal once). To hand a
non-technical person a **Treats.app** they can just double-click, build a
distributable with electron-builder. Code-signing + notarization need *your*
Apple Developer account, so this is a step you run on your own machine.

## Ready-to-run prompt (paste to Claude Code in the repo)

> Package the Electron pet (`packages/overlay`) into a distributable macOS app
> using electron-builder. It's an npm-workspaces monorepo and the overlay imports
> `@treats/core` (pure Node, zero deps) — make sure the packaged app bundles the
> `packages/core` files so the bundled `treats.js` resolves at runtime. Steps:
> 1. Add `electron-builder` as a devDependency and an `electron-builder.yml` (or a
>    `build` block) targeting macOS `dmg` + `zip`, appId `app.treats.pet`,
>    productName "Treats", category `public.app-category.developer-tools`.
> 2. Include the core package in `files`/`extraResources` and verify
>    `@treats/core` resolves from inside the asar (or set `asarUnpack`).
> 3. Add an app icon (generate `build/icon.icns` from the tray star or a pet emoji).
> 4. Add an `npm run build:app` script and run it; confirm `dist/Treats-*.dmg` opens
>    and the pet appears.
> 5. If I have an Apple Developer ID, sign + notarize; otherwise produce an unsigned
>    build and document the Gatekeeper "right-click → Open" first-run step.
> Report the exact `dist/` artifact paths when done.

## Notes / gotchas

- **Unsigned builds** open with a Gatekeeper warning; users right-click → Open the
  first time. Signing + notarization (Apple Developer Program, ~$99/yr) removes it.
- The pet writes to `~/.treats/` and reads `~/.claude/settings.json` — those paths
  are unaffected by packaging.
- The hooks/slash-commands still install via `treats install` or the plugin; the
  packaged app is only the pet UI.
