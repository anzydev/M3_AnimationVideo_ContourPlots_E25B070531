# The Lowest Point — Contour Plots: Finding the Global Minimum

**Linear Algebra and Calculus (M3) • Internal Assessment (Project Option 1: Animation Video)**  
**Student:** Khushagra Rawal  
**URN:** `E25B070531`  
**Batch:** `Hopper-Debugger`  
**Duration:** `5m 36.9s` (`10,107 frames` @ `1920×1080`, `30 fps`, H.264 + 48 kHz Stereo AAC)

---

## Learning Objective
By the end of this video, the viewer will be able to interpret 2D contour plots as horizontal slices of a 3D surface $z = f(x, y)$, compute exact shifted circular level sets $(x - 1)^2 + (y + 2)^2 = c$ with radii $r = \sqrt{c}$, explain why a zero gradient alone can be a saddle rather than a minimum, and prove a unique global minimum using nonnegative squares.

---

## Repository Contents

| File / Folder | Description |
|---|---|
| [`ContourPlots_Video.mp4`](./ContourPlots_Video.mp4) | Complete 1080p 16:9 animated educational video (`00:00–00:17.07` kinetic Intro synced word-by-word and URN letter-by-letter; `00:17.07–05:30.90` main 3D/2D film; `05:30.90–05:36.90` silent Credits & AI Disclosure slide). |
| [`Storyboard.pdf`](./Storyboard.pdf) | 6-scene M3 storyboard PDF (Hook/Context, Concept Introduction, Visual Intuition, Worked Example, Interpretation & Proof, Summary & Credits) with keyframe renders. |
| [`_Code/`](./_Code) | Complete editable animation, 3D WebGL2/GLSL shader, KaTeX HUD, speech-alignment, and procedural audio source code. |
| [`docs/`](./docs) | Verbatim & intended transcripts, word timestamps (`word_timestamps.json`), subtitles (`subtitles.srt`), discrepancy log (`recording_discrepancies.csv`), Viva Q&A notes (`VIVA_NOTES.md`), credits/AI disclosure, and technical `QA_REPORT.md`. |

---

## Mathematical Summary Covered
1. **Flat Map Problem:** Position $(x, y) \in \mathbb{R}^2$ hides height $z$.
2. **Height Surface & Horizontal Slices:** $z = f(x, y)$ intersected with $z = c$ projects down to level curves $f(x, y) = c$.
3. **Worked Example:** $f(x, y) = (x - 1)^2 + (y + 2)^2$:
   - Shifted center $(1, -2) \neq (0, 0)$.
   - Level curves $(x - 1)^2 + (y + 2)^2 = c$ have radius $r = \sqrt{c}$: $c = 1 \Rightarrow r = 1$, $c = 4 \Rightarrow r = 2$, $c = 9 \Rightarrow r = 3$ (contrasted against the common mistake $r = c$).
   - Degenerate $c = 0 \Rightarrow \{(1, -2)\}$; negative $c < 0 \Rightarrow \emptyset$.
4. **Partial Derivatives & Saddle Counterexample:** $\frac{\partial f}{\partial x} = 2(x - 1) = 0$ and $\frac{\partial f}{\partial y} = 2(y + 2) = 0 \implies \nabla f(1, -2) = (0, 0)$. Contrast with $g(x, y) = x^2 - y^2$, which also has $\nabla g(0, 0) = (0, 0)$ yet is a saddle.
5. **Global Minimum Proof:** $(x - 1)^2 \ge 0$ and $(y + 2)^2 \ge 0 \implies f(x, y) \ge 0$ for all $(x, y) \in \mathbb{R}^2$, with $f(1, -2) = 0$, proving the **unique global minimum** of $0$ at $(1, -2)$.

---

## Reproducing the Animation from `_Code/`
```bash
# 1. Install Node renderer dependencies (Three.js, KaTeX, Playwright)
cd _Code/renderer && npm install

# 2. Render keyframes or full scenes
node render_intro.mjs --keyframes
node render_movie.mjs --keyframes
node render_credits.mjs --preview
```

---

## Credits & AI Transparency Disclosure
- **Human Voiceover & Presentation:** Khushagra Rawal (100% authentic human recording across Intro and Main narration; zero TTS or voice cloning).
- **AI Coding & Animation Assistant:** **Antigravity (Google DeepMind)** — used for speech alignment, discrepancy auditing, storyboard generation, Three.js/GLSL shader programming, silent character rigging ("Pip"), kinetic intro/credits rendering, procedural audio mixing, and QA verification.
- **Libraries & Tools:** Three.js (MIT), KaTeX (MIT), HTML5 Canvas2D, Playwright / Chromium (Apache 2.0), `faster-whisper` (MIT), Python / NumPy / SciPy / SoundFile, and FFmpeg (LGPL/GPL).
- **Audio:** Original speech-ducked D-major harmonic pad & chimes synthesized procedurally in Python (`_Code/build_audio.py`, `_Code/build_intro_audio.py`); no copyrighted music used.
