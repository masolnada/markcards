# Markcards

Self-hostable flashcard app. Write decks as plain Markdown files, review cards with [FSRS 4.5](https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm) spaced-repetition scheduling.

Decks can live on your local filesystem or in a GitHub repository.

---

## Installation

### Docker (recommended)

**Local decks** — mount a directory of `.md` files:

```bash
docker run -d \
  --name markcards \
  -p 3000:3000 \
  -v markcards-data:/data \
  -v /path/to/your/decks:/decks \
  ghcr.io/your-username/markcards
```

**GitHub decks** — fetch directly from a repo (no volume mount needed):

```bash
docker run -d \
  --name markcards \
  -p 3000:3000 \
  -v markcards-data:/data \
  -e GITHUB_REPO=alice/flashcards \
  -e GITHUB_TOKEN=ghp_... \
  ghcr.io/your-username/markcards
```

The `/data` volume stores the SQLite database (review history, scheduling state) and persists across container restarts.

**Build the image yourself:**

```bash
git clone https://github.com/your-username/markcards
cd markcards
docker build -t markcards .
```

---

### Manual install

Requirements: **Node.js 24+**, npm.

```bash
git clone https://github.com/your-username/markcards
cd markcards
npm install
npm run build
npm run start
```

Open `http://localhost:3000`.

---

## Configuration

All configuration is via environment variables. Copy `.env.example` to `.env` and edit as needed.

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP port to listen on |
| `DECKS_DIR` | `./decks` | Directory of `.md` deck files (local mode) |
| `DB_PATH` | `./markcards.db` | Path to the SQLite database file |
| `GITHUB_REPO` | — | Enable GitHub mode: `owner/repo` |
| `GITHUB_TOKEN` | — | Personal access token (required for private repos; raises rate limit to 5 000 req/hr) |
| `GITHUB_BRANCH` | `main` | Branch to read decks from |
| `GITHUB_PATH` | `` | Subdirectory within the repo, e.g. `decks`. Defaults to the repo root |
| `SYNC_TTL_MS` | `60000` | How often to re-fetch from GitHub (milliseconds). Set to `0` to sync on every request |

When `GITHUB_REPO` is set, `DECKS_DIR` is ignored.

---

## Deck format

Decks are plain `.md` files. Each file is one deck. Cards are separated by a blank line or a `---` divider.

### Deck name (optional frontmatter)

```
---
name = "My Deck"
---
```

If omitted, the deck name is taken from the filename (without `.md`).

### Question & Answer cards

```
Q: What does HTTP stand for?
A: HyperText Transfer Protocol
```

Multi-line questions and answers are supported — just continue on the next line without a prefix:

```
Q: What is the quadratic formula?
A: For ax² + bx + c = 0:
   x = (−b ± √(b² − 4ac)) / 2a
```

### Cloze deletion cards

Wrap each word or phrase to be tested in `[square brackets]`. Each bracketed item becomes a separate card.

```
C: The capital of [France] is [Paris].
```

This produces two cards:
- "The capital of **_____** is Paris." → reveal: France
- "The capital of France is **_____**." → reveal: Paris

### Markdown

All text fields support standard Markdown — bold, italic, code blocks, lists, links, images, etc.

````
Q: What does this Python snippet print?
   ```python
   print([x**2 for x in range(4)])
   ```
A: `[0, 1, 4, 9]`
````

### Math (LaTeX / KaTeX)

Inline math with `$...$`, display math with `$$...$$`:

```
Q: What is the derivative of $x^2$?
A: $2x$

Q: State the Pythagorean theorem.
A: $$a^2 + b^2 = c^2$$
```

### Full example file

```markdown
---
name = "Calculus basics"
---

Q: What is the derivative of $x^n$?
A: $nx^{n-1}$

---

Q: What is the integral of $\frac{1}{x}$?
A: $\ln|x| + C$

---

C: A [definite integral] computes the net area under a curve between two bounds.

---

Q: State the fundamental theorem of calculus.
A: If $F' = f$, then:
   $$\int_a^b f(x)\,dx = F(b) - F(a)$$
```

---

## How card IDs work

Card IDs are derived from the card content (question + answer text for Q&A, template + position for cloze). Renaming a deck file or moving it does **not** reset review history as long as the card text stays the same. Editing a card's text creates a new card.

---

## Development

```bash
npm install
npm run dev      # watch mode: rebuilds on file changes, restarts server
npm run typecheck
```
