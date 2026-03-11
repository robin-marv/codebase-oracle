# codebase-oracle

A personality profiler for codebases. Feed it a GitHub repo, get back a character read.

Not a linter. Not a metrics tool. Something stranger — it reads the commits, the file structure, the PR descriptions, and tells you what kind of codebase you're actually dealing with.

```
oracle https://github.com/you/your-repo
```

```
────────────────────────────────────────────────────────────
  ◈  THE CODEBASE ORACLE  ◈

  you/your-repo
  The Meticulous Overthinker

────────────────────────────────────────────────────────────

  CORE CHARACTER

  This codebase is deeply uncomfortable with ambiguity. Every edge
  case has been considered, documented, and probably re-considered
  at 11pm on a Wednesday...
```

---

## Requirements

- **Node.js 18+**
- **[gh CLI](https://github.com/cli/cli)** — installed and authenticated (`gh auth login`)
- **An [Anthropic API key](https://console.anthropic.com/)** — set as an environment variable or paste it when prompted

---

## Usage

### With npx (no install)

```bash
npx codebase-oracle https://github.com/owner/repo
```

### Installed globally

```bash
npm install -g codebase-oracle
oracle https://github.com/owner/repo
```

### Repo formats accepted

```bash
oracle https://github.com/vercel/next.js
oracle facebook/react
oracle owner/repo
```

---

## API Key

The oracle uses Claude (Anthropic) to generate readings. You need to supply your own key.

**Option 1 — environment variable (recommended):**

```bash
export ANTHROPIC_API_KEY=sk-ant-...
oracle owner/repo
```

**Option 2 — paste when prompted:**

If `ANTHROPIC_API_KEY` isn't set, the oracle will ask for it at runtime. The key is used for that session only and is never stored.

Get a key at [console.anthropic.com](https://console.anthropic.com).

---

## What it reads

- File structure and composition
- Up to 20 sampled source files (core files prioritised)
- Last 60 commits (messages, authors, dates)
- Last 20 pull request titles and descriptions (public repos)

Works on any public GitHub repo. Works on private repos you have `gh` access to.

---

## What it produces

- **Archetype** — a 2-4 word label for the codebase's personality
- **Core Character** — what it values, what it fears, how it thinks
- **Strengths** — what it actually does well
- **Tensions** — contradictions between what it wants to be and what it is
- **Commit Autopsy** — a character analysis of the most revealing commit message
- **The Verdict** — what it would be like to work here

---

## Notes

- Works best on repos with meaningful commit history and PR descriptions
- Brand new repos with one commit will get a shallow reading
- The oracle has opinions. They are not always flattering.
