# Trilium Web Clipper - Unofficial

A small, dependency-free Manifest V3 browser extension for self-hosted Trilium Notes. It deliberately connects only to the address you configure—there is no localhost port scan.

## Install (Chromium)

1. In Trilium, create an ETAPI token: **Options → ETAPI**.
2. Visit `chrome://extensions`, enable **Developer mode**, select **Load unpacked**, and choose this directory.
3. Open the extension’s **Settings**, enter your Trilium server address, paste the token, and select **Test connection**.
4. Clip a selection or page from the toolbar popup, or use the page’s right-click menu.

Trilium stores the result beneath the note marked with the `clipperInbox` label; if none exists, it uses today’s day note. Multiple clips of the same URL and type append to the same note, matching Trilium’s server-side clipper behavior.

## Privacy and security

The server address and token are stored locally in the browser's extension storage. The token is sent only as the `Authorization` header to the configured Trilium server. Prefer HTTPS if the server is reachable beyond your private LAN.

## Scope

- Selection, page, link, and quick-text clips.
- Keyboard shortcut: `Ctrl+Shift+Y` / `Command+Shift+Y`.
- Page clips retain basic HTML and convert relative links/images to absolute URLs. When using the built-in clipper inbox mode, Trilium also handles its normal image processing.
- By default, clips are filed as `Clippings/YYYYMMDD/<clip title>` using Trilium ETAPI. The destination path is configurable in Settings, for example `ideaverse/Clippings`. Disable **Save clips under Clippings/YYYYMMDD** to use Trilium’s built-in clipper inbox behavior instead.
