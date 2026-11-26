import json
import os
import wave
import numpy as np
from faster_whisper import WhisperModel

AUDIO_WAV = "/Users/khushagrarawal/Desktop/VIDEO_math/voiceover_alignment_16k.wav"
OUT_JSON = "/Users/khushagrarawal/Desktop/VIDEO_math/logs/whisper_raw.json"
OUT_RMS = "/Users/khushagrarawal/Desktop/VIDEO_math/logs/audio_envelope.json"

os.makedirs(os.path.dirname(OUT_JSON), exist_ok=True)

# 1. Compute 10ms RMS envelope for exact pause/speech boundary verification
with wave.open(AUDIO_WAV, "rb") as wf:
    sr = wf.getframerate()
    n_frames = wf.getnframes()
    pcm = np.frombuffer(wf.readframes(n_frames), dtype=np.int16).astype(np.float32) / 32768.0

hop = int(sr * 0.02)  # 20ms frames
rms_list = []
for i in range(0, len(pcm), hop):
    chunk = pcm[i:i + hop]
    rms = float(np.sqrt(np.mean(chunk ** 2))) if len(chunk) > 0 else 0.0
    rms_list.append(round(rms, 5))

with open(OUT_RMS, "w") as f:
    json.dump({"sample_rate": sr, "hop_sec": 0.02, "duration_sec": len(pcm) / sr, "rms": rms_list}, f)

# 2. Run faster-whisper WITHOUT prompting bias first (unbiased verbatim)
# Pass numpy float32 PCM directly to avoid PyAV 19 metadata_errors incompatibility
model = WhisperModel("small.en", device="cpu", compute_type="int8")
segments, info = model.transcribe(
    pcm,
    language="en",
    word_timestamps=True,
    vad_filter=False,
    condition_on_previous_text=False,
    beam_size=5,
)

seg_data = []
for seg in segments:
    words = []
    for w in (seg.words or []):
        words.append({
            "word": w.word,
            "start": round(w.start, 3),
            "end": round(w.end, 3),
            "probability": round(w.probability, 4),
        })
    seg_data.append({
        "id": seg.id,
        "start": round(seg.start, 3),
        "end": round(seg.end, 3),
        "text": seg.text.strip(),
        "avg_logprob": round(seg.avg_logprob, 4),
        "no_speech_prob": round(seg.no_speech_prob, 4),
        "words": words,
    })

with open(OUT_JSON, "w") as f:
    json.dump({"duration": info.duration, "segments": seg_data}, f, indent=2)

print(f"Transcribed {len(seg_data)} segments, duration={info.duration:.3f}s")
for s in seg_data:
    print(f"[{s['start']:6.2f} - {s['end']:6.2f}] {s['text']}")

