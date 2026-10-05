# @kit API (import from '@kit'). Infrastructure + OPTIONAL helpers — invent your own components freely.

## Clock (required)
- `useVO(): VO` → `{ fps, W, H, P (portrait?), aspect, total, cue(c), lines, line(id), brand, safe }`
  - `cue("m02:gambar")` → frame where the spoken word starts. Forms: `"m02"`, `"m02:word"`, `"m02:word#2"`,
    `"m02:word+0.3"` (seconds offset), `"end"`. Use words from the VO line's spoken `text`.
  - `lines[i] = { id, text, caption, start, end }` (frames). `safe` = box to keep key content in (captions sit below
    `safe.bottom`; landscape 1920×1080 safe ≈ x100–1820, y70–940; portrait 1080×1920 ≈ x60–1020, y140–1600).
  - `brand = { name, url, mark: 'vikey'|'monogram', color? }`
- Frame: `useCurrentFrame()` from 'remotion'. Everything must be a pure function of the frame (deterministic).

## Animation math
`clamp01(v)`, `prog(t, a, b, ease?)` eased 0→1 between frames a..b (default ease-out), `pop(t, t0, k=4)` springy
0→1 with overshoot, `hitEnv(t, at)` eased punch envelope, `kf(t, [[frame, value, ease?], …])` keyframes,
`seeded(n)` deterministic 0..1 random, `typed(str, t, at, cps)`. Easings: `outE`, `inOut`, `flyE`, `lin`.
`Easing`, `interpolate`, `spring` from 'remotion' are fine too.

## Text (measure big text!)
- `<Fit text font weight size maxW track? style?>{children?}</Fit>` → single line, shrinks to fit maxW (marks
  `data-fit` for QA). `fit(text, font, weight, maxSize, maxW, trackEm)` → number (size) for custom layouts.
  `textW(text, font, weight, size, trackEm)` → width in px.
- `<Chars text t at step? mode?>` per-glyph reveal; mode `'rise'|'drop'|'blur'|'scale'|'slam'`.
- `<Typewriter text t at cps? caret? caretH? style?>`, `<Caret t h color>`.
- `<Odometer text t at color ghost?>` slot-roll digits ("Rp3.600"), `<CountUp t to start end locale? prefix? suffix?>`.
- `<Highlight t at color>` marker swipe, `<Strike t at color>` strike-through.

## 2.5D (optional)
- `camAt(keys, t)` keys `[frame, {x,y,z,r}, ease?]`; `project3D(p, cam, W, cy, F=1200)` → `{x, y, s, d}`.
- `<Billboard3D cam p w h W H cy? focusZ? unfocus?>` perspective-scaled element with lens blur (always-on filter).
- `<Particles3D cam prev W H color hot n?>`, `<Floor3D cam W H y color alpha>`, `focusWeight(t, a, b)`.

## FX (optional)
- `useHits([{at, kind:'shake'|'punch'|'flash', amp?}], t)` → `{x, y, scale, flash}` apply to your world wrapper.
- `<Grain W H opacity?>`, `<Burst t at x y color>`, `<Whip t at a b color W H>`, `<Confetti t at W H colors>`.

## UI motion shells (optional — fill them with your own UI)
- `<Phone w? dark? time? screenBg?>{screen content}</Phone>` (outer w, ~2.07:1).
- `<Window kind='mac'|'win'|'browser' w h title? url? dark?>{content}</Window>`.
- `<Cursor t x y clicks? color?>`, `<Notification t at app title body w? icon? dark?>`, `<Mark size>` (brand mark).

## Scene module contract (your file)
```tsx
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { useVO, Fit, Chars, prog /* … */ } from '@kit';

export const fonts = { 'Unbounded': ['700'], 'Onest': ['400', '600'] }; // families from the font list below
export const background = '#0E0F12';                                        // frame background
export const captionStyle = { bg: 'rgba(0,0,0,0.85)', fg: '#fff', hot: '#FF5A1F', font: 'Onest' }; // optional
export const sfx = (vo) => [[vo.cue('m01:baru') - 4, 'pop', 0.6]];        // optional [frame, name, volume]
// sfx names: fly whoosh pop type impact roll scan slash stamp whip tick chime

export default function Scene() {
  const t = useCurrentFrame();
  const { W, H, P, cue } = useVO();
  return <AbsoluteFill>{/* your world */}</AbsoluteFill>;
}
```
Fonts available: Unbounded, Onest, Azeret Mono, Sora, Inter, Inter Tight, JetBrains Mono, Bricolage Grotesque,
Geist, Geist Mono, Syne, Hanken Grotesk, Fragment Mono, Space Grotesk, Space Mono, Manrope, IBM Plex Mono,
Archivo Black, Archivo, DM Mono, DM Sans, Instrument Serif, Instrument Sans, Fraunces, Playfair Display, Newsreader,
Anton, Bebas Neue, Oswald, Caveat, Permanent Marker, Shadows Into Light, Fredoka, Baloo Two, Sniglet, Montserrat,
Poppins, Plus Jakarta Sans, Outfit, Lexend, Figtree, Urbanist, Rubik Mono One, Bungee, Righteous.
