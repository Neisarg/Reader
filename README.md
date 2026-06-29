# Reader

A research paper reading and management application with deep Zotero integration, an AI-powered assistant, and a full-featured PDF viewer with annotations.

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Zotero](https://img.shields.io/badge/Zotero-integrated-cc2936)
![License](https://img.shields.io/badge/license-MIT%20with%20Attribution-green)

---

## Features

### Paper Management
- **Kanban board** with five reading statuses: Glance, Read, Study, Experiment, Done
- **Zotero collections** as the primary filter — browse all your collections from the sidebar
- **Search** across your Zotero library
- **Done toggle** — completed papers hidden from the board, shown on demand
- **Reading status synced** to Zotero via tags (`reader/glance`, `reader/read`, etc.)

### PDF Viewer
- **Continuous scroll** through all pages using react-pdf
- **Text selection** with floating toolbar (Highlight / Ask AI)
- **Highlighting** — select text, pick a color, highlights rendered on the PDF and synced to Zotero
- **Eraser tool** — click highlights to remove them
- **Page sidebar** — navigate by page number
- **Split view** — second pane with independent page navigation
- **Zoom controls** with auto-fit to width

### Raven — AI Research Assistant
- **Powered by Claude Code** — uses your existing Claude Code subscription, no separate API key needed
- **Full paper context** — extracts the complete PDF text and sends it with every query
- **Markdown responses** with LaTeX math rendering (KaTeX)
- **Quick prompts** — one-click questions like "Summarize in 3 bullet points"
- **Ask AI from PDF** — select text, click "Ask AI" to get instant explanations
- **Status logging** — shows paper loading progress

### Notes
- **Markdown editor** with live preview (Edit/Preview toggle)
- **LaTeX math** support in preview
- **Synced to Zotero** as a note attachment (single note per paper, updates in place)
- **Lossless round-trip** — raw markdown preserved in HTML comments
- **Resizable panel** — drag the border to adjust width (up to 50% of screen)
- **Persistent** — notes survive tab switches between Raven and Notes

### Highlights
- **Visual highlighting** on the PDF with 5 colors (Yellow, Green, Blue, Pink, Orange)
- **Persisted** in localStorage and **synced to Zotero** as formatted note attachments
- **Auto-save** — highlights debounce-save to Zotero after 2 seconds

---

## Architecture

```
src/
├── app/
│   ├── api/
│   │   ├── chat/          # Raven AI — spawns claude CLI
│   │   ├── highlights/    # Save/load highlights to Zotero
│   │   ├── models/        # List available Claude models
│   │   ├── pdf/           # PDF proxy + text extraction
│   │   └── zotero/        # Items, collections, tags, notes, attachments
│   ├── paper/[key]/       # Paper reading page
│   └── page.tsx           # Main kanban board
├── components/
│   ├── PdfViewer.tsx      # PDF viewer with highlights
│   ├── ChatPanel.tsx      # Raven AI assistant
│   ├── NotesPanel.tsx     # Markdown notes editor
│   ├── PaperCard.tsx      # Paper card on the board
│   └── StatusColumn.tsx   # Kanban status column
└── lib/
    ├── annotations.ts     # Highlight data types and storage
    ├── hooks.ts           # usePapers, useCollections
    ├── types.ts           # Paper, ReadingStatus, etc.
    └── zotero.ts          # Zotero API client
```

---

## Setup

### Prerequisites

- **Node.js** 18+ (via Homebrew: `brew install node`)
- **Zotero account** with an API key
- **Claude Code** installed and logged in (for Raven AI)
- **pdftotext** (via Homebrew: `brew install poppler`) for PDF text extraction

### Installation

```bash
git clone https://github.com/neisarg/Reader.git
cd Reader
npm install
```

### Configuration

Create `.env.local`:

```env
# Zotero — get your key at https://www.zotero.org/settings/keys
ZOTERO_API_KEY=your_key_here
ZOTERO_USER_ID=your_user_id
```

No Anthropic API key needed — Raven uses your Claude Code subscription directly.

### Running

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm run build
npm start
```

**As a Mac app:**
```bash
npm run install-app
```
Then launch from Spotlight (Cmd+Space, type "Reader") or Launchpad.

---

## How It Works

### Zotero Integration

Reader uses the [Zotero Web API](https://www.zotero.org/support/dev/web_api/v3/start) to:

- Fetch papers from your library and collections
- Read/write reading status via tags
- Save highlights as formatted note attachments
- Save notes as child items with embedded markdown

All changes sync bidirectionally — updates in Reader appear in Zotero and vice versa.

### Raven AI

Raven spawns the `claude` CLI process (`claude -p --output-format stream-json --verbose`) for each query. The full paper text (extracted via `pdftotext`) is included in every prompt, giving Raven complete access to the paper content. Responses stream in real-time with full Markdown and LaTeX math rendering.

### PDF Text Extraction

Uses `pdftotext` (from Poppler) to extract the full text from downloaded PDFs. The text is cached in the browser session and sent with every AI query.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS 4 |
| PDF Viewer | react-pdf + pdfjs-dist |
| AI | Claude Code CLI |
| Math | KaTeX |
| Markdown | react-markdown + remark-gfm + remark-math |
| Icons | Lucide React |
| Backend | Zotero Web API, pdftotext |

---

## License

MIT License with Attribution — free to use, modify, and distribute. Derivative works must cite the original:

> **Reader** by Neisarg Dave

See [LICENSE](LICENSE) for full terms.
