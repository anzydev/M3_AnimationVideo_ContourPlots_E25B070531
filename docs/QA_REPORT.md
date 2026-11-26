# Quality Assurance Report — *The Lowest Point: Contour Plots — Finding the Global Minimum*

## 1. Technical Media Verification (Measured on Final Deliverables: Intro + Main + Silent Credits)
| File | Video Codec & Resolution | Frame Rate & Count | Duration | Audio Stream | Size | Decode / Blackdetect |
|---|---|---|---|---|---|---|
| `output/MATH_VIDEO_FINAL.mp4` | H.264 High (`yuvj420p`), `1920x1080` native | `30.000 fps`, `10,107` frames (`512` intro + `9,415` main + `180` credits) | `336.900000s` | AAC LC, `48000 Hz`, stereo, `256 kbps` (`15,790` packets) | `227,922,665` bytes (~217 MB) | Zero decode errors; `0` black frames (`blackdetect d=0.1, pix_th=0.05`) |
| `output/MATH_VIDEO_VOICE_ONLY.mp4` | H.264 High (`yuvj420p`), `1920x1080` native | `30.000 fps`, `10,107` frames (`512` intro + `9,415` main + `180` credits) | `336.900000s` | AAC LC, `48000 Hz`, stereo, `192 kbps` (original voice only + 6.0s silent credits) | `224,786,451` bytes (~214 MB) | Zero decode errors; exact 1:1 narration sync reference |

### Appended Silent Credits & AI Transparency Slide (`330.900s – 336.900s`, `180` frames)
- Rendered in `project/renderer/credits.html` / `credits_main.js` / `render_credits.mjs` and verified from `output/MATH_VIDEO_FINAL.mp4` (`review/credits_final_check.png`).
- **Digital Silence Verified:** `volumedetect` over `331.0s – 336.9s` measured `mean_volume: -91.0 dB`, `max_volume: -91.0 dB` (no music, no voice, no sound effects).
- Explicitly credits Khushagra Rawal (human narration), **Antigravity (Google DeepMind)** (AI coding & animation assistant), Three.js, KaTeX, HTML5 Canvas2D, Playwright/Chrome, faster-whisper, Python/NumPy/SciPy/SoundFile, and FFmpeg.

### Audio Mix Measurements (`output/MATH_VIDEO_FINAL.mp4`)
- `mean_volume`: `-24.8 dB`
- `max_volume`: `-6.2 dB` (clean headroom, zero clipping)
- Main voiceover (`voiceover_master.m4a`) RMS: `0.0582`; main score RMS: `0.0071`. Intro (`INTRO.mp4` -> `project/intro_master.m4a`) peak with ambient bed: `0.3130` (zero clipping).
- Zero TTS, voice cloning, or non-student spoken audio anywhere in the film.

### Prepended Intro Slide (`0.000s – 17.067s`, `512` frames)
- Extracted audio from `INTRO.mp4` (`17.001s` audio, `17.067s` container) and aligned every word plus each individual character of URN `E25B070531` via `faster-whisper` + 20 ms RMS peak analysis (`logs/intro_whisper.json`).
- Kinetic word/character timings verified: `"Hello everyone"` (`0.58s`/`0.88s`), `"Khushagra Rawal"` (`2.46s`/`2.90s`), `"Hopper Debugger Batch"` (`5.06s`/`5.64s`/`6.24s`), URN letters `E` (`8.38s`), `2` (`8.86s`), `5` (`9.18s`), `B` (`9.56s`), `0` (`9.94s`), `7` (`10.76s`), `0` (`11.22s`), `5` (`11.76s`), `3` (`12.28s`), `1` (`12.94s`), and `"my maths project"` (`15.42s`–`16.26s`).
- Seam frames (`review/intro_qa/seam_01.png`–`seam_05.png`) visually verified from `output/MATH_VIDEO_FINAL.mp4` across the intro, character flash, and transition at frame `512` (`17.067s`) into the main film.

## 2. Speech Alignment & Discrepancy Audit
- **Alignment method:** `faster-whisper` (`small.en`, `int8`, `beam_size=5`, `vad_filter=False`) over `voiceover_alignment_16k.wav`, audited against a 20 ms RMS envelope (`logs/audio_envelope.json`) and 8 extracted WAV listening clips (`logs/clips/`).
- **Verified word count:** `733` aligned words in `output/word_timestamps.json`.
- **Key spoken sync anchors verified:**
  - Opening `"Imagine"` onset: `0.58s` (RMS verified)
  - `"tiny dot"`: `6.80s`
  - `"left"` / `"right"` / `"forward"` / `"backward"`: `20.88s`, `21.96s`, `22.82s`, `23.72s`
  - `"contour plots"`: `31.54s`
  - `"x and y ... z"`: `42.38s` – `45.86s`
  - `"lifting the map into three directions [dimensions]"`: `53.34s` – `55.08s`
  - `"lowering a perfectly level sheet of glass"`: `75.12s` – `77.54s`
  - `"Look straight down at the intersection"`: `85.84s` – `86.98s`
  - `"f(x, y) = (x - 1)^2 + (y + 2)^2"`: `113.02s` – `120.58s`
  - `"center ... (1, -2), not at (0, 0)"`: `137.30s` – `143.14s`
  - `"c = 1 -> r = 1"`, `"c = 4 -> r = 2"`, `"c = 9 -> r = 3"`: `172.78s`, `176.66s`, `179.46s`
  - `"c is 0"` / `"c is negative"`: `200.98s` / `206.76s`
  - `"partial derivatives"`: `223.28s` – `244.56s`
  - `"saddle shaped surface"`: `250.40s` – `256.88s`
  - `"sum of two squares ... unique global minimum"`: `262.46s` – `286.82s`
  - `"Thank you for watching"`: `310.28s` – `311.10s`
- **Spoken slips & handling:** All minor non-contradictory word slips (`"directions"` for `"dimensions"` at `0:54.8`, `"glow/globe"` for `"grow"` at `3:08.5`, `"asking"` for `"using"` at `3:16.2`, slurred `"when we've"` at `5:06.3`, plus minor grammar/articulation slips) are logged in `output/recording_discrepancies.csv`. None materially contradict the mathematics; visuals clarify intended concepts cleanly without contradicting the voice.

## 3. Mathematics Review (Checked Against `reference.txt`)
- Function: $f(x,y) = (x-1)^2 + (y+2)^2$ — exact formula, signs, and shifted center $(1,-2) \neq (0,0)$ verified on screen.
- Level curves: $c=1 \Rightarrow r=1$, $c=4 \Rightarrow r=2$, $c=9 \Rightarrow r=3$; explicit contrast against the common mistake $r=c$.
- Degenerate & empty levels: $c=0 \Rightarrow \{(1,-2)\}$ single point; $c<0 \Rightarrow \emptyset$ shown with glass plane descending below $z=0$.
- Critical point & saddle trap: $\partial f/\partial x = 2(x-1)$, $\partial f/\partial y = 2(y+2)$, $\nabla f(1,-2) = (0,0)$; counterexample $g(x,y) = x^2 - y^2$ with $\nabla g(0,0) = (0,0)$ rising along $x$ and falling along $y$.
- Global minimum proof: $(x-1)^2 \ge 0$ and $(y+2)^2 \ge 0 \Rightarrow f(x,y) \ge 0\ \forall (x,y)\in\mathbb{R}^2$, achieved at $(1,-2)$ where $f(1,-2) = 0$; local vs. global distinction illustrated.
- Vertical axis scaling note: 3D surface heights are visually scaled (`Z_VIS_SCALE_TERRAIN = 0.68`, `Z_VIS_SCALE_BOWL = 0.34`, `Z_VIS_SCALE_SADDLE = 0.22`) for camera readability while all printed coordinates, level values $c$, and radii $r$ remain exact.

## 4. Visual & Motion QA Findings
- **Bug caught and resolved during QA:** In the initial full render, `#math-dom` screenshots captured opaque `body` background and underlying canvases, freezing animation between formula transitions. Fixed in `project/renderer/index.html` (`background: transparent`) and `project/renderer/render_movie.mjs` (hiding `#gl-canvas` and `#hud-canvas` during discrete DOM card capture), then re-rendered all 9,415 frames cleanly (`5.37 Mbps` video stream).
- **Decoded MP4 frame inspection:** Verified `review/final_qa/final_01.png` through `final_07.png` extracted directly from `output/MATH_VIDEO_FINAL.mp4` (`141.8s`, `183.5s`, `209.2s`, `256.5s`, `283.0s`, `307.0s`, `312.5s`). All equations, 3D geometries, Pip animations, callout pills, and end card text are sharp, legible, and properly composed.
- **Remaining minor notes:** Under strict pixel-difference `freezedetect=n=0.001:d=1.5`, a few static-camera equation-reading holds (where only the rotating beacon gem / Pip's small head motion occurs, e.g., `119.9–126.2s`, `157.2–168.2s`, `213.9–222.1s`, `235.8–248.9s`) have low whole-frame pixel delta while the viewer reads the equations, and `311.1–313.8s` is the intentional closing End Card hold.

