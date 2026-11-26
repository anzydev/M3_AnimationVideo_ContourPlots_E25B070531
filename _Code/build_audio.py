import json
import os
import subprocess
import numpy as np
from scipy.signal import butter, sosfilt

ROOT = "/Users/khushagrarawal/Desktop/VIDEO_math"
VOICE_M4A = os.path.join(ROOT, "voiceover_master.m4a")
VOICE_48K_WAV = os.path.join(ROOT, "project/voice_48k_tmp.wav")
ENV_JSON = os.path.join(ROOT, "logs/audio_envelope.json")
SCORE_WAV = os.path.join(ROOT, "project/ambient_score_48k.wav")
FINAL_MIX_M4A = os.path.join(ROOT, "project/audio_final_mix.m4a")

SR = 48000

# 1. Decode voiceover_master.m4a to 48kHz stereo float PCM (for measurement & mixing ONLY; master stays untouched)
subprocess.run([
    "ffmpeg", "-y", "-i", VOICE_M4A, "-ar", str(SR), "-ac", "2", "-f", "wav", VOICE_48K_WAV
], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

import soundfile as sf
voice, vsr = sf.read(VOICE_48K_WAV, dtype="float32")
assert vsr == SR
n_samples = len(voice)
dur = n_samples / SR
t = np.arange(n_samples, dtype=np.float32) / SR

# 2. Compute smooth speech ducking envelope from voice amplitude
voice_mono = np.max(np.abs(voice), axis=1)
# Downsample envelope check every 20ms, smooth with attack=40ms, release=450ms
win = int(0.02 * SR)
n_win = int(np.ceil(n_samples / win))
speech_env = np.zeros(n_win, dtype=np.float32)
for i in range(n_win):
    seg = voice_mono[i * win : min(n_samples, (i + 1) * win)]
    speech_env[i] = float(np.sqrt(np.mean(seg ** 2))) if len(seg) else 0.0

# Smooth binary-ish speech presence (threshold 0.012)
presence = np.clip((speech_env - 0.008) / 0.020, 0.0, 1.0)
smoothed = np.zeros_like(presence)
cur = 0.0
for i in range(len(presence)):
    target = presence[i]
    coef = 0.35 if target > cur else 0.04  # fast duck on speech, gentle release in pauses
    cur = cur + coef * (target - cur)
    smoothed[i] = cur

# Upsample duck gain: 0.046 in pauses, 0.020 during speech
duck_win = 0.046 - 0.026 * smoothed
duck_gain = np.interp(np.arange(n_samples), np.arange(n_win) * win, duck_win).astype(np.float32)

# 3. Synthesize warm minimalist ambient harmonic score (D major / B minor / G major7 / A sus4 cycle)
chords = [
    [146.83, 220.00, 293.66, 369.99],  # D major add9 feel
    [123.47, 185.00, 246.94, 329.63],  # Bm7
    [196.00, 246.94, 293.66, 369.99],  # Gmaj7
    [110.00, 164.81, 220.00, 329.63],  # Asus2/A
]
chord_dur = 12.0  # slow meditative 12s harmonic drift
pad_l = np.zeros(n_samples, dtype=np.float32)
pad_r = np.zeros(n_samples, dtype=np.float32)

# Build smooth crossfaded harmonic pad
for ci, freqs in enumerate(chords):
    # Active in windows ci*12 mod 48
    phase_mask = np.zeros(n_samples, dtype=np.float32)
    cycle = len(chords) * chord_dur
    t_mod = (t - ci * chord_dur) % cycle
    # Smooth raised-cosine envelope over [0, chord_dur] with 2.5s overlap
    in_w = np.clip(t_mod / 2.5, 0.0, 1.0)
    out_w = np.clip((chord_dur + 2.0 - t_mod) / 2.5, 0.0, 1.0)
    env = np.where(t_mod < chord_dur + 2.0, np.minimum(in_w, out_w), 0.0).astype(np.float32)
    for fi, f0 in enumerate(freqs):
        det = 1.0 + 0.0018 * np.sin(0.25 * t + fi)
        sig = 0.55 * np.sin(2 * np.pi * f0 * t * det) + 0.20 * np.sin(2 * np.pi * (f0 * 2.0) * t)
        pan = 0.5 + 0.25 * np.sin(0.15 * t + fi * 1.3)
        pad_l += env * sig * (1.0 - pan * 0.5)
        pad_r += env * sig * (0.5 + pan * 0.5)

# Low-pass filter pad warmly at 780 Hz so speech clarity is 100% untouched
sos = butter(4, 780.0, btype="low", fs=SR, output="sos")
pad_l = sosfilt(sos, pad_l).astype(np.float32)
pad_r = sosfilt(sos, pad_r).astype(np.float32)

# Normalize pad before applying duck_gain
max_pad = max(float(np.max(np.abs(pad_l))), float(np.max(np.abs(pad_r))), 1e-6)
pad_l = (pad_l / max_pad) * duck_gain
pad_r = (pad_r / max_pad) * duck_gain

# 4. Add subtle original crystal chimes & cues at key story beats (soft -22 dB)
def add_chime(buf_l, buf_r, t0, freq, decay=1.4, amp=0.032, pan=0.5):
    i0 = int(t0 * SR)
    n = int(min(n_samples - i0, decay * 3.5 * SR))
    if i0 < 0 or n <= 0:
        return
    tt = np.arange(n, dtype=np.float32) / SR
    env = np.exp(-tt / decay) * (1.0 - np.exp(-tt / 0.015))
    tone = env * (0.75 * np.sin(2 * np.pi * freq * tt) + 0.25 * np.sin(2 * np.pi * freq * 2.0 * tt)) * amp
    buf_l[i0:i0 + n] += tone * (1.0 - 0.4 * pan)
    buf_r[i0:i0 + n] += tone * (0.6 + 0.4 * pan)

cues = [
    (31.54, 587.33, 1.3, 0.026, 0.5),   # Contour sonar preview (D5)
    (53.20, 440.00, 1.6, 0.024, 0.4),   # 3D lift (A4)
    (74.80, 659.25, 1.4, 0.024, 0.6),   # Glass plane descent (E5)
    (139.50, 739.99, 1.5, 0.030, 0.5),  # Center (1,-2) beacon (F#5)
    (172.80, 587.33, 1.0, 0.026, 0.4),  # c=1 -> r=1 (D5)
    (176.70, 659.25, 1.0, 0.026, 0.5),  # c=4 -> r=2 (E5)
    (179.60, 739.99, 1.1, 0.028, 0.6),  # c=9 -> r=3 (F#5)
    (202.20, 440.00, 1.2, 0.024, 0.5),  # c=0 point (A4)
    (249.45, 311.13, 1.4, 0.026, 0.5),  # Saddle trap warning shimmer (D#4)
    (276.60, 587.33, 2.0, 0.032, 0.4),  # Global minimum proved (D5 + F#5 + A5)
    (276.65, 739.99, 2.0, 0.024, 0.5),
    (276.70, 880.00, 2.2, 0.022, 0.6),
    (310.30, 587.33, 2.2, 0.028, 0.5),  # Ending resolution chord
    (310.35, 880.00, 2.2, 0.020, 0.5),
]
for t0, freq, dec, amp, pan in cues:
    add_chime(pad_l, pad_r, t0, freq, dec, amp, pan)

# Gentle 1.5s fade-in at start and 2.5s fade-out at end
fade_in = np.minimum(1.0, t / 1.5).astype(np.float32)
fade_out = np.minimum(1.0, np.maximum(0.0, (dur - t) / 2.2)).astype(np.float32)
pad_l *= fade_in * fade_out
pad_r *= fade_in * fade_out

score = np.stack([pad_l, pad_r], axis=1)
sf.write(SCORE_WAV, score, SR, subtype="PCM_16")

# Mix with voiceover (voiceover at 1.0x unity gain, gentle limiter safety check)
mix = voice + score
peak = float(np.max(np.abs(mix)))
if peak > 0.92:
    # Soft safety ceiling only if needed
    mix = mix * (0.92 / peak)

mix_wav = os.path.join(ROOT, "project/audio_final_mix_tmp.wav")
sf.write(mix_wav, mix, SR, subtype="PCM_16")

subprocess.run([
    "ffmpeg", "-y", "-i", mix_wav, "-c:a", "aac", "-b:a", "256k", FINAL_MIX_M4A
], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

# Clean temp WAVs
for p in [VOICE_48K_WAV, mix_wav]:
    if os.path.exists(p):
        os.remove(p)

voice_rms = float(np.sqrt(np.mean(voice ** 2)))
score_rms = float(np.sqrt(np.mean(score ** 2)))
print(f"Audio mix ready: duration={dur:.3f}s, voice_rms={voice_rms:.4f}, score_rms={score_rms:.4f}, peak={float(np.max(np.abs(mix))):.4f}")

