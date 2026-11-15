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

The whole page is drawn with one field of points, the way a lidar would see
it. That is Mercury's own treatment, and everything else stays quiet around it.

- **One cloud, many scenes.** `lib/cloud.ts` holds a fixed number of points
  and `lib/targets.ts` says what they can become: an aircraft sampled from its
  real surface, the tool rack, the fleet passing messages as streams of
  points, a room found by a lidar sweep, two printed arms under load, the
  Mercury mark. `components/world.tsx` owns the one instance and re-forms it
  as each chapter crosses the middle of the screen, so the page never cuts.
  New ideas get a new target in that file, not a separate diagram.
- **Text holds the left, points hold the right.** On a phone the field is a
  band across the top and the text scrolls under it. It turns under a drag
  and coasts at the speed it was let go.
- **Studio renders are the one place the points step aside.** The film and
  the close-up plates are Cycles renders of a dark studio and stay dark in
  both themes (`bg-plate`).
- **One family of type** (Host Grotesk for now; a fitted face is planned),
  at modest sizes: 18px reading text, `.sec-h` for a chapter's heading, one
  larger line in the hero and at the close.
- **Nothing is hairline.** No monospace labels, no thin grey text, no 1px
  rules. Secondary text is `text-muted` and never under 16px. Structure
  comes from space, not lines.
- **Colour comes from tokens** in `app/globals.css`, which flip under
  `html[data-theme="light"]`; the field reads them, so it follows the theme.
  Cyan (`accent`) marks what is live or direct, amber what is relayed or
  charging, orange the TPU feet.
- **Choices are underlined text** (`.choice`): a drone, a tool head, a mode.
  There is one small flat button (`.btn`). No navigation bar, pills or cards.
- **Motion is the field re-forming.** Text arrives through opacity and a 6px
  blur (`.arrive`, `.swap`), never by sliding in. With reduced motion the
  field draws each scene still.

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
