import os
import subprocess
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt

ROOT = "/Users/khushagrarawal/Desktop/VIDEO_math"
INTRO_M4A = os.path.join(ROOT, "project/intro_master.m4a")
INTRO_WAV_TMP = os.path.join(ROOT, "project/intro_48k_tmp.wav")
INTRO_VOICE_PADDED = os.path.join(ROOT, "project/intro_voice_padded.m4a")
INTRO_MIX_M4A = os.path.join(ROOT, "project/intro_audio_mix.m4a")

SR = 48000
TARGET_DUR = 512 / 30.0  # 17.066667s exact match to 512 frames @ 30fps
TARGET_SAMPLES = int(round(TARGET_DUR * SR))

subprocess.run([
    "ffmpeg", "-y", "-i", INTRO_M4A, "-ar", str(SR), "-ac", "2", "-f", "wav", INTRO_WAV_TMP
], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

voice, vsr = sf.read(INTRO_WAV_TMP, dtype="float32")
assert vsr == SR

# Pad or trim cleanly to exact TARGET_SAMPLES (tail silence only ~65ms)
if len(voice) < TARGET_SAMPLES:
    pad = np.zeros((TARGET_SAMPLES - len(voice), 2), dtype=np.float32)
    voice_exact = np.vstack([voice, pad])
else:
    voice_exact = voice[:TARGET_SAMPLES]

# Save exact-length voice-only AAC for seamless concatenation with voiceover_master.m4a
tmp_v = os.path.join(ROOT, "project/intro_voice_exact_tmp.wav")
sf.write(tmp_v, voice_exact, SR, subtype="PCM_16")
subprocess.run([
    "ffmpeg", "-y", "-i", tmp_v, "-c:a", "aac", "-b:a", "192k", INTRO_VOICE_PADDED
], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

# Speech-ducked ambient D-major bed + subtle crystal pings on URN chars
t = np.arange(TARGET_SAMPLES, dtype=np.float32) / SR
v_mono = np.max(np.abs(voice_exact), axis=1)
win = int(0.02 * SR)
n_win = int(np.ceil(TARGET_SAMPLES / win))
s_env = np.array([
    float(np.sqrt(np.mean(v_mono[i*win:min(TARGET_SAMPLES, (i+1)*win)]**2)))
    for i in range(n_win)
], dtype=np.float32)
pres = np.clip((s_env - 0.008) / 0.020, 0.0, 1.0)
sm = np.zeros_like(pres)
cur = 0.0
for i in range(len(pres)):
    cur = cur + (0.35 if pres[i] > cur else 0.05) * (pres[i] - cur)
    sm[i] = cur
duck = np.interp(np.arange(TARGET_SAMPLES), np.arange(n_win) * win, 0.044 - 0.024 * sm).astype(np.float32)

freqs = [146.83, 220.00, 293.66, 369.99]  # D major add9 matching Act I opening
pad_l = np.zeros(TARGET_SAMPLES, dtype=np.float32)
pad_r = np.zeros(TARGET_SAMPLES, dtype=np.float32)
for idx, f0 in enumerate(freqs):
    sig = 0.6 * np.sin(2 * np.pi * f0 * t) + 0.2 * np.sin(2 * np.pi * f0 * 2.0 * t)
    pan = 0.35 + 0.1 * idx
    pad_l += sig * (1.0 - 0.3 * pan)
    pad_r += sig * (0.7 + 0.3 * pan)

sos = butter(4, 780.0, btype="low", fs=SR, output="sos")
pad_l = sosfilt(sos, pad_l).astype(np.float32)
pad_r = sosfilt(sos, pad_r).astype(np.float32)
mx = max(float(np.max(np.abs(pad_l))), float(np.max(np.abs(pad_r))), 1e-6)
pad_l = (pad_l / mx) * duck
pad_r = (pad_r / mx) * duck

def add_ping(bl, br, t0, freq, amp=0.018, dec=0.45):
    i0 = int(t0 * SR)
    n = int(min(TARGET_SAMPLES - i0, dec * 3.0 * SR))
    if i0 < 0 or n <= 0:
        return
    tt = np.arange(n, dtype=np.float32) / SR
    env = np.exp(-tt / dec) * (1.0 - np.exp(-tt / 0.008))
    tone = env * np.sin(2 * np.pi * freq * tt) * amp
    bl[i0:i0+n] += tone
    br[i0:i0+n] += tone

# Subtle soft crystal ticks on URN tiles + project reveal
urn_times = [8.38, 8.86, 9.18, 9.56, 9.94, 10.76, 11.22, 11.76, 12.28, 12.94]
scale = [587.33, 659.25, 739.99, 880.00, 987.77, 587.33, 659.25, 739.99, 880.00, 1174.66]
for ts, fr in zip(urn_times, scale):
    add_ping(pad_l, pad_r, ts, fr, amp=0.015, dec=0.35)
add_ping(pad_l, pad_r, 15.55, 587.33, amp=0.025, dec=1.1)
add_ping(pad_l, pad_r, 15.60, 880.00, amp=0.020, dec=1.1)

fade_in = np.minimum(1.0, t / 0.6).astype(np.float32)
fade_out = np.minimum(1.0, np.maximum(0.0, (TARGET_DUR - t) / 0.5)).astype(np.float32)
pad_l *= fade_in * fade_out
pad_r *= fade_in * fade_out

mix = voice_exact + np.stack([pad_l, pad_r], axis=1)
peak = float(np.max(np.abs(mix)))
if peak > 0.92:
    mix = mix * (0.92 / peak)

tmp_mix = os.path.join(ROOT, "project/intro_mix_tmp.wav")
sf.write(tmp_mix, mix, SR, subtype="PCM_16")
subprocess.run([
    "ffmpeg", "-y", "-i", tmp_mix, "-c:a", "aac", "-b:a", "256k", INTRO_MIX_M4A
], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

for p in [INTRO_WAV_TMP, tmp_v, tmp_mix]:
    if os.path.exists(p):
        os.remove(p)

print(f"Intro audio ready: {TARGET_DUR:.3f}s, peak={float(np.max(np.abs(mix))):.4f}")

