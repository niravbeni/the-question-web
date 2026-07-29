# Women's Health × AI: an IDEO project

A public provocation in the spirit of [IDEO's Big Questions](https://big-questions.ideo.com/): visitors finish a sentence in their own words, a facilitator sharpens their point of view with at most three questions, and the result joins an anonymous **landscape**: clustered into topics, stretched across the **creative tensions** (two opposing ideas at either end of a line, every voice placed between them) the field has to resolve.

To show the IDEO logo in the header, drop a file named `ideo-logo.svg` (or `.png`) into `public/`: it replaces the text wordmark automatically.

## The experience

1. **Finish the sentence**: the landing page offers five huge sentence starters ("What worries me most about AI in women's health is…"). The visitor continues one into a short paragraph.
2. **Three questions, then done**: a facilitator asks up to three short follow-ups (strictly finite; the visitor can skip to the summary at any point).
3. **Approve the summary**: the model drafts a 1-3 sentence anonymous third-person summary; the visitor edits it freely and publishes with one explicit click.
4. **Land on the landscape**: the view is placed immediately into the best-fitting topic and scored on that topic's tension axes. The visitor is taken straight to their dot, marked "you".
5. **Recalibrate**: as new voices accumulate (every 8, or manually from the admin page), the whole corpus is re-clustered, topics and tensions are re-derived, and every voice is re-placed.

## Stack & models

- **Next.js 16** (App Router) + **React 19** + **TypeScript** + **Tailwind CSS v4**
- **Postgres** via [postgres.js](https://github.com/porsager/postgres): Supabase in production, plain local Postgres in dev. The schema auto-creates and seeds on first use; no migrations to run.
- **OpenAI**
  - `gpt-5.6-terra`: the live facilitator chat (fast, reliable tool calls; `reasoning_effort: "none"` as required for tools on chat completions)
  - `gpt-5.6-sol`: the analytical pipeline: clustering views into topics, labeling them, deriving creative tensions, and scoring every view on every axis
  - `text-embedding-3-small`: embeddings (k-means fallback for very large corpora)
  - `omni-moderation-latest`: publish gate
  - Override with `OPENAI_CHAT_MODEL` / `OPENAI_ANALYSIS_MODEL` in `.env.local`.

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the values
createdb tensions_dev        # local Postgres (brew install postgresql if needed)
npm run dev
```

`.env.local` needs three values:

| Variable | What it is |
| --- | --- |
| `OPENAI_API_KEY` | Facilitator chat, embeddings, moderation, analysis |
| `DATABASE_URL` | Postgres connection string (`postgresql://localhost:5432/tensions_dev` locally) |
| `ADMIN_PASSWORD` | Gates `/admin` and the manual recalibrate endpoint |

Open [http://localhost:3000](http://localhost:3000). The database seeds itself with 24 hand-written views across 4 precomputed topics, so the landscape is legible before anyone contributes.

> **No OpenAI key?** Everything still demos: the facilitator falls back to scripted questions and the landscape uses the seed structure. Publishing works; new views stay "unplaced" until a recalibration (which needs a key).

## Deploying (Vercel + Supabase)

1. **Create a Supabase project** at [supabase.com](https://supabase.com) (free tier is plenty). No SQL to run: the app creates its own tables on first request.
2. **Copy the connection string**: in the Supabase dashboard, click **Connect** (top bar) and copy the **Transaction pooler** URI (port `6543`), substituting your database password.
3. **Import the repo into Vercel** and set three environment variables: `OPENAI_API_KEY`, `DATABASE_URL` (the pooler URI), and `ADMIN_PASSWORD`.
4. **Deploy.** The first visit seeds the landscape automatically.

`/admin` (edit/delete views, clear test data, reset to seeds, recalibrate) asks for `ADMIN_PASSWORD` in the browser.

## How the pieces fit

```
src/
  app/
    page.tsx                       Landing (hero, sentence starters, preview)
    contribute/[starterId]/page.tsx  The finite contribution flow
    landscape/page.tsx             The landscape (topics + tension axes)
    about/page.tsx                 About
    api/
      pov/chat/route.ts            Streaming facilitator (max 3 questions -> finalize_pov)
      pov/route.ts                 Moderate -> persist -> embed -> immediate placement
      landscape/route.ts           Assembled landscape JSON
      recalibrate/route.ts         Manual full recalibration (admin only)
      admin/povs/route.ts          Admin: list / edit / delete / reset (password-gated)
  content/
    starters.ts                    The five sentence starters
    copy.ts                        All copy + versioned consent text
    seed.ts                        Seed views + precomputed topics/tensions/positions
  lib/
    openai.ts                      Model split (chat vs analysis) + client
    prompt.ts                      Finite facilitator prompt
    tools.ts                       finalize_pov schema
    analysis.ts                    LLM clustering, tension derivation, scoring,
                                   immediate placement, auto-recalibration trigger
    db.ts                          Postgres schema, queries, landscape assembly
    adminAuth.ts                   ADMIN_PASSWORD header check
    seed.ts                        Idempotent first-run seeding
    mine.ts                        localStorage "which dots are mine" identity
  components/
    ContributeFlow.tsx             write -> chat -> review -> published
    LandscapeView.tsx              Topics, tension axes, dots, "you" markers
    Header.tsx
```

## The recalibration pipeline

`POST /api/recalibrate` (admin only; also fires automatically after every 8 new views, or earlier when several new voices fit the current topics poorly):

1. **Embed** any views missing embeddings.
2. **Cluster**: the analysis model partitions all summaries into 3-6 coherent topics by meaning (k-means over embeddings is the fallback above ~120 views; undersized clusters are merged).
3. **Derive**: per topic: a label, a one-line summary, and 2-3 creative tensions (two opposing poles that both have merit, plus what is at stake).
4. **Score**: every member view gets a position from −1 (pole A) to 1 (pole B) on every axis.
5. **Commit**: the new landscape replaces the old atomically; each run is recorded in `calibration_runs`.

New views published between runs are placed immediately (best-fitting existing topic + scores) so nobody lands in a void.

## Data, consent & safety

- The public artifact is the **approved summary only**, always anonymous. Transcripts stay private.
- "You" markers live in the visitor's own localStorage: the server never links views to people.
- Publishing is an explicit user click on versioned consent language (`src/content/copy.ts`); the model never publishes.
- Moderation gates every publish; per-IP rate limits protect chat, publish, and recalibration.
