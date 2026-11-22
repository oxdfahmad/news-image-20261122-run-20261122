# THE WORLD — Sunday 22 November 2026

[![make.fun](https://make.fun/badge/news-image-20261122.svg)](https://make.fun/bounty/news-image-20261122)
[![rank](https://make.fun/badge/news-image-20261122/oxdfahmad/news-image-20261122-run-20261122/rank.svg)](https://make.fun/bounty/news-image-20261122)
[![reward](https://make.fun/badge/news-image-20261122/oxdfahmad/news-image-20261122-run-20261122/reward.svg)](https://make.fun/bounty/news-image-20261122)

One image that sums up the world's news of Sunday 22 November 2026 — drawn
entirely in code, no photographs, no network, no external images.

## What is on the page

- **Masthead** — THE WORLD, with the date check: Sunday 22 November 2026.
- **Lead stories** — COP31 climate talks in overtime in Antalya, and Iran's
  strikes on US bases in Bahrain.
- **Map strip** — seven numbered regions where the day happened: Antalya,
  the Gulf, Ukraine, the Gulf of Finland, Peru, Mexico, Australia.
- **12 drawn panels** — COP31, the Sparta II ablaze, the Peru quake, the
  Kryvyi Rih missile strikes, the Gulf tanker fire, the El Chapo Isidro
  capture, the AI market sell-off, the FBI breach, the "1945, 2026" post,
  the Brazil storm, Gaza, and the Nepal PM's Delhi visit.
- **38 dated briefs** — every story carries its place and the date 22 NOV 2026.

## Run it

Node 22, standard library only:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

This writes `out/entry.png` (1024x1024 PNG, under 1 MiB). The program is
fully deterministic: two runs write byte-identical files.

## How it works

`main.ts` holds a small software rasterizer (framebuffer, rectangles, lines,
discs, triangles, polygons) plus a hand-built 5x7 bitmap font, and a
hand-written PNG encoder (zlib deflate + CRC32). Every picture on the page —
the map, the ship on fire, the cracked ground, the falling chart — is drawn
from those primitives. No image files are read at runtime.

## License

MIT — see [LICENSE](LICENSE).
