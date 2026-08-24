# 🧠 Mind Space

A pure front-end thought-organizing tool — dump ideas from your mind onto an infinite canvas and organize them with colored zones and drag-and-drop. Single HTML file, zero dependencies, works offline.

![single-file](https://img.shields.io/badge/single-file-HTML-success) ![no-deps](https://img.shields.io/badge/dependencies-zero-brightgreen) ![dark-mode](https://img.shields.io/badge/dark%20mode-supported-blue)

**🔗 Live demo: https://alexlzhust.github.io/mind-space/**

## ✨ Features

### Core
- **Quick capture**: Type an idea in the top input bar, press `Enter` to create a card. Supports `^tag` syntax for instant tagging (e.g. `want to run ^health`)
- **Zone categorization**: Drag a card into a colored zone to auto-categorize. Custom themes with editable names and colors
- **Automatic organization**: One click classifies active cards into existing topics and arranges topic zones around the centered unsorted zone. Matching uses local topic names, tags, and learned keywords; it creates no topics, sends no data to a server, and the whole operation can be undone with `Ctrl/Cmd+Z`
- **Wheel zoom / drag pan**: Infinite canvas, free exploration
- **Archive without loss**: Archived ideas can be restored anytime from the drawer
- **Search auto-fit**: Searching auto-focuses the viewport onto matching cards
- **Import / Export**: JSON format, supports merge (dedup by ID) and overwrite modes
- **Undo system**: `Ctrl/Cmd+Z` undoes delete, archive, edit, and clear-all

### v3 additions
- **Expanded canvas**: 16000×16000 super-large canvas (CSS variable, adjustable)
- **Edit undo**: Editing a card is undoable — restores pre-edit content and position
- **Coordinate migration**: Unsorted zone is now relative to the window center; importing v2 data auto-migrates coordinates
- **Dark-mode zone overlay**: Light-colored zones get a subtle overlay in dark mode so they aren't glaring
- **Mac trackpad gestures**: Pinch to zoom, two-finger scroll to pan, double-tap smart zoom
- **Bottom shortcut hint bar**: Always visible at the canvas bottom, updates dynamically with OS mode

### v3.2 additions
- **Smart Ctrl/Cmd+Enter**: Edit modal open → save; input focused → submit; otherwise → focus the input
- **Clear all**: Dangerous action with confirmation + undoable; preserves theme zones

## ⌨️ Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + Enter` | Smart: save edit / submit idea / focus input |
| `Ctrl/Cmd + K` | Focus search |
| `Ctrl/Cmd + Z` | Undo (delete / archive / edit / clear-all) |
| `Esc` | Close popup / clear input |

**Mac trackpad gestures**: pinch to zoom · two-finger scroll to pan · click-drag to move cards · double-tap to smart zoom

## 🚀 Usage

### Option A — try it live
Open the hosted demo on GitHub Pages:
**https://alexlzhust.github.io/mind-space/**

### Option B — run locally
Download `index.html` and open it in any browser. No build step, no server, no installation required.

Data is stored in the browser's `localStorage` (key `mindspace.v1`).

## 🎨 Theming

- **Dark / Light**: Follow the system or toggle manually
- **Win / Mac mode**: Switches shortcut symbols (Ctrl / ⌘) and trackpad gesture support
- **Custom zones**: Edit zone names and colors in the topic manager

## 📦 Data

All data lives locally in the browser (`localStorage`, key `mindspace.v1`). Use "Export" for periodic backups.

## 📄 License

MIT
