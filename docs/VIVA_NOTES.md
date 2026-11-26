# Individual Viva / Q&A Preparation Guide
**Topic:** Contour Plots — Finding the Global Minimum  
**Student:** Khushagra Rawal (`URN: E25B070531`, Batch: `Hopper-Debugger`)

---

## 1. Core Mathematical Derivations (Be Ready to Explain on Paper)

1. **Two-variable function & height surface:**
   - $f: \mathbb{R}^2 \to \mathbb{R}$ takes an ordered pair $(x, y)$ and outputs a scalar $z = f(x, y)$, visualized as elevation above the $xy$-plane.
2. **Level curve (contour) definition:**
   - Intersecting the surface $z = f(x, y)$ with a horizontal plane $z = c$ and projecting onto the $xy$-plane gives the level set $\{(x, y) \in \mathbb{R}^2 : f(x, y) = c\}$.
3. **Why the worked example center is $(1, -2)$ and NOT $(0, 0)$:**
   - $f(x, y) = (x - 1)^2 + (y + 2)^2 = (x - 1)^2 + (y - (-2))^2$.
   - The first term measures squared horizontal distance from $x = 1$; the second measures squared vertical distance from $y = -2$. Both vanish together only at $(1, -2)$.
4. **Why $r = \sqrt{c}$ (and why $r \neq c$):**
   - Setting $f(x, y) = c$ gives $(x - 1)^2 + (y + 2)^2 = c$, the standard circle $(x - h)^2 + (y - k)^2 = r^2$ with center $(h, k) = (1, -2)$ and $r^2 = c \implies r = \sqrt{c}$ (for $c > 0$).
   - Examples: $c = 1 \Rightarrow r = 1$; $c = 4 \Rightarrow r = 2$; $c = 9 \Rightarrow r = 3$.
   - When $c = 0$: $(x-1)^2 + (y+2)^2 = 0 \implies x=1, y=-2$ (a single point).
   - When $c < 0$: empty set $\emptyset$ over $\mathbb{R}^2$ because squares of real numbers cannot sum to a negative number.
5. **Partial derivatives & critical point:**
   - $\frac{\partial f}{\partial x} = 2(x - 1)$ (holding $y$ constant), $\frac{\partial f}{\partial y} = 2(y + 2)$ (holding $x$ constant).
   - Setting $\nabla f = (0, 0)$ yields $2(x-1)=0 \Rightarrow x=1$ and $2(y+2)=0 \Rightarrow y=-2$.
6. **Why $\nabla f = (0, 0)$ alone is NOT sufficient (Saddle Counterexample):**
   - Consider $g(x, y) = x^2 - y^2$. Then $\nabla g(x, y) = (2x, -2y)$, so $\nabla g(0, 0) = (0, 0)$.
   - Yet along $y = 0$, $g(x, 0) = x^2 \ge 0$ (rises); along $x = 0$, $g(0, y) = -y^2 \le 0$ (falls). Thus $(0,0)$ is a saddle point, not a minimum.
7. **Rigorous Global Minimum Proof (Nonnegative Squares):**
   - For all $(x, y) \in \mathbb{R}^2$: $(x - 1)^2 \ge 0$ and $(y + 2)^2 \ge 0 \implies f(x, y) \ge 0$.
   - At $(1, -2)$, $f(1, -2) = 0^2 + 0^2 = 0$, achieving the global lower bound.
   - If $(x, y) \neq (1, -2)$, at least one square is strictly positive, so $f(x, y) > 0$. Therefore $(1, -2)$ is the **unique global minimum** (lowest across all of $\mathbb{R}^2$, stronger than a mere local minimum).

---

## 2. Animation Code Walkthrough (How Your Project Works)

- **3D Engine (`_Code/renderer/math_world.js`):**
  - Maps mathematical coordinates $(x, y, z) \mapsto \text{Three.js }(x, z_{\text{vis}}, -y)$ (right-handed).
  - Builds 3 smooth meshes: dynamic 2D→3D terrain (`150×150` grid), circular polar paraboloid bowl (`72×128`), and circular hyperbolic saddle (`64×128`), all using a custom GLSL `onBeforeCompile` shader that draws coordinate grids, contour lines, and glowing glass-plane intersection rings (`abs(vWorldPos.y - uSliceY)`).
  - Animates **Pip**, an articulated silent 3D explorer made of Three.js primitives (`CapsuleGeometry`, `SphereGeometry`, `TorusGeometry`, `OctahedronGeometry`).
- **Deterministic Synchronization (`_Code/renderer/main.js` & `intro_main.js`):**
  - `renderAtTime(t)` evaluates easing curves (`smoothstep`, `lerp`, `spring`) purely from `t = frame / 30.0`, matched to real word timestamps from `faster-whisper` and 20 ms RMS audio envelopes (`_Code/transcribe_align.py`).
  - KaTeX renders equations cleanly in HTML, captured transparently per card change and composited with WebGL2 + Canvas2D HUD overlays.
- **Audio & Mastering (`_Code/build_audio.py`, `_Code/build_intro_audio.py`):**
  - Preserves your real human voiceover (`INTRO.mp4` and `2026-11-26 18-48-11.mp4`) and synthesizes a speech-ducked, 780 Hz low-passed D-major ambient harmonic pad + crystal chimes in NumPy/SciPy, plus a 6-second silent Credits slide via FFmpeg.

