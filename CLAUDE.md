# Mercury

The landing page for Mercury, a company that designs drones that do real
physical work for people. Next.js 16 (static export), React 19, Tailwind v4,
three.js for the live 3D view. Deployed to GitHub Pages by
`.github/workflows/deploy.yml`.

## Commands

Use Bun.

```
bun install
bun run dev
bun run build        # static export to out/
bun run lint && bun run typecheck
```

This is Next.js 16: APIs and conventions may differ from older versions. Read
the guide in `node_modules/next/dist/docs/` before using an API you are not
sure of.

## What must stay true

- The company is **Mercury**. No other project name appears anywhere.
- **These are designs.** The CAD is real, but nothing has flown and the
  electronics in the models are size stand-ins. Never write that a drone "can"
  or "does" something as if tested: write "is designed to", or say what it is
  for. `SITE.footnote` goes under anything that describes behaviour.
- Publish no dimensions or part lists beyond roles and purposes.
- `SITE.email` in `lib/site.ts` is a placeholder until Mercury supplies the
  address it wants public.

## The look

- **One family, Geist.** Scale and weight do the work: `.display` for names
  and the big lines, `.title` for a chapter's opening line, `.lede` under it.
- **Nothing is hairline.** No monospace labels, no faint grey text, no 12px
  captions. Secondary text is `text-muted` and at least 14px, usually medium
  weight. Tags and buttons are solid pills (`.pill`, `.tag`).
- **Colour comes from tokens** in `app/globals.css`, which flip under
  `html[data-theme="light"]`. Cyan (`accent`) marks what is live or direct,
  amber marks what is relayed or charging. Render plates are photographs of a
  dark studio and stay dark in both themes (`bg-plate`, `text-plate-fg`).
- **Entrances resolve focus.** Things arrive through opacity and blur
  (`Resolve`, `.arrive`), never by sliding in. Do not blur full-screen
  surfaces. Loops pause off screen, and reduced motion gets the finished state.
- **No top navigation.** The page is one scroll: film, statement, flight
  line, pinned scenes, three diagrams, founder, contact.

## Copy

Full sentences in a plain "we" voice. No clipped fragments for effect and no
em dashes. A heading says the thing, and one sentence under it explains.

## Models and renders

`scripts/models/` holds the whole pipeline (Blender as the `bpy` Python
module, Cycles on CPU):

1. `build.py <kit glb dir> <built dir>` swaps the flat propeller discs in the
   CAD exports for real blades and rounds hard edges (`props.py`).
2. `optimize.sh <built dir>` compresses them into `public/models`.
3. `shots.sh <built dir> <scratch>` renders the close-ups, one plate per
   aircraft and the opening film; `render.py` is the studio.
4. `export.py <scratch> public/img` writes the WebP plates, `hero.mp4`, the
   poster and the social card.

The source GLBs come from the Mercury website kit and are not in the repo.
