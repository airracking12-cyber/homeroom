#!/usr/bin/env python3
"""
Renders Homeroom's sound effects and its background music loop to audio files.

    python3 tools/render_sounds.py            # writes public/sounds/v2/*.mp3
    python3 tools/render_sounds.py --report   # also prints loudness numbers and writes a spectrogram sheet

Why offline: the old sounds were made live in the browser from plain sine waves and noise. Here every sound is built the way
a real mallet, glass bell or sheet of paper behaves (a set of ringing partials that fade at different speeds, a tiny strike
click, a short room reverb, a little stereo spread), then saved. The browser only plays the files.

Everything is deterministic (fixed seeds), so running it again gives the same files. To change how loud one sound is, edit
LEVELS below (dB, peak) and run it again. To make a new version that browsers must re-download, change VERSION here AND
SOUND_BASE in src/lib/sound.js.

Needs numpy, scipy and ffmpeg. Everything is saved as high-quality mp3 (VBR quality 2, near-transparent), which is about a fifth the size
of WAV and plays in every browser.
"""
import os, sys, wave, subprocess
import numpy as np
from scipy import signal

SR = 44100
VERSION = "v2"
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "sounds", VERSION)
TAU = 2 * np.pi

# peak level of each file in dB below full scale. Frequent sounds are quiet, rare "moments" are louder.
LEVELS = {
    "tap1": -17, "tap2": -17, "tap3": -17, "pop1": -15, "pop2": -15, "pop3": -15, "add": -12, "done": -10, "undo": -15,
    "send": -14, "err": -13, "bell": -11, "rip1": -12, "rip2": -12, "rip3": -12, "whoosh": -15, "stamp": -6, "lift": -15,
    "boxOpen": -10, "schoolbell": -11,
}

# ───────────────────────── building blocks ─────────────────────────

def tarr(d):
    return np.arange(int(round(d * SR))) / SR

def sos_filter(x, kind, f, order=2):
    f = np.atleast_1d(f).astype(float)
    f = np.clip(f, 20, SR * 0.45)
    sos = signal.butter(order, f if len(f) > 1 else f[0], btype=kind, fs=SR, output="sos")
    return signal.sosfilt(sos, x, axis=0)

def lowpass(x, f, order=2): return sos_filter(x, "low", f, order)
def highpass(x, f, order=2): return sos_filter(x, "high", f, order)
def bandpass(x, lo, hi, order=2): return sos_filter(x, "band", [lo, hi], order)

def tail(x, ms=30):
    """Softly end a mono piece of sound so it never stops with a click."""
    x = np.array(x, dtype=float)
    n = min(int(ms / 1000 * SR), len(x) // 3)
    if n > 1: x[-n:] *= np.cos(np.linspace(0, np.pi / 2, n)) ** 2
    return x

def fade(x, fin=0.002, fout=0.01):
    x = x.copy()
    n = len(x)
    a, b = min(n, int(fin * SR)), min(n, int(fout * SR))
    if a > 0: x[:a] *= np.sin(np.linspace(0, np.pi / 2, a)) ** 2 if x.ndim == 1 else (np.sin(np.linspace(0, np.pi / 2, a)) ** 2)[:, None]
    if b > 0: x[n - b:] *= np.cos(np.linspace(0, np.pi / 2, b)) ** 2 if x.ndim == 1 else (np.cos(np.linspace(0, np.pi / 2, b)) ** 2)[:, None]
    return x

def mix_into(buf, x, at):
    """Add x (mono or stereo) into buf starting at time `at` seconds, growing buf if needed."""
    i = int(round(at * SR))
    if buf.shape[0] < i + x.shape[0]:
        pad = np.zeros((i + x.shape[0] - buf.shape[0],) + buf.shape[1:])
        buf = np.concatenate([buf, pad], axis=0)
    buf[i:i + x.shape[0]] += x
    return buf

def msum(*xs):
    """Add mono signals of different lengths together."""
    n = max(len(x) for x in xs)
    out = np.zeros(n)
    for x in xs: out[: len(x)] += tail(x, 25)
    return out

def pan(x, p):
    """Mono to stereo, equal power. p in [-1, 1]."""
    a = (p + 1) * np.pi / 4
    return np.stack([x * np.cos(a), x * np.sin(a)], axis=1)

# ───────────────────────── instruments (modal synthesis) ─────────────────────────
# Each instrument is a few partials: frequency ratio, loudness, and how long it rings (seconds, at 440 Hz).
# Higher partials die faster, and low notes ring longer than high ones: that is most of what makes a note sound "real".
KINDS = {
    "marimba": dict(r=[1, 3.99, 9.25], a=[1, 0.32, 0.07], tau=[0.34, 0.08, 0.03]),
    "kalimba": dict(r=[1, 5.4, 13.3], a=[1, 0.28, 0.05], tau=[0.55, 0.07, 0.02]),
    "celesta": dict(r=[1, 2.76, 5.4, 8.93], a=[1, 0.42, 0.18, 0.07], tau=[0.95, 0.34, 0.15, 0.06]),
    "glass": dict(r=[1, 2.32, 4.25, 6.63], a=[1, 0.5, 0.28, 0.12], tau=[1.3, 0.7, 0.4, 0.2]),
    "wood": dict(r=[1, 2.4, 4.1], a=[1, 0.5, 0.25], tau=[0.035, 0.022, 0.014]),
    "felt": dict(r=[1, 2.0, 3.0], a=[1, 0.18, 0.05], tau=[0.16, 0.06, 0.03]),
    "bell": dict(r=[0.5, 1, 1.19, 1.5, 2, 2.5, 2.97, 4.07], a=[0.3, 1, 0.5, 0.36, 0.45, 0.2, 0.18, 0.1],
                 tau=[1.5, 1.35, 1.0, 0.85, 0.75, 0.5, 0.4, 0.28]),
}

def strike(freq, dur, kind="marimba", vel=1.0, attack=0.003, rng=None, ringscale=1.0, click=0.5):
    """One struck note. `ringscale` stretches how long it rings."""
    rng = rng or np.random.default_rng(1)
    k = KINDS[kind]
    t = tarr(dur)
    y = np.zeros_like(t)
    scale = (440.0 / freq) ** 0.35 * ringscale
    for r, a, tau in zip(k["r"], k["a"], k["tau"]):
        f = freq * r * (1 + rng.normal(0, 0.0006))
        if f > SR * 0.42: continue
        y += a * np.sin(TAU * f * t + rng.uniform(0, TAU)) * np.exp(-t / (tau * scale))
    y *= 1 - np.exp(-t / max(attack / 4, 1e-4))                       # soft attack
    # the tiny "tick" of the mallet touching the bar: a few milliseconds of filtered noise
    n = int(0.006 * SR)
    c = bandpass(rng.normal(0, 1, n), min(freq * 2, 6000), min(freq * 6, 12000))
    c *= np.exp(-np.arange(n) / (0.0012 * SR)) * click * 0.25 * vel
    y[:n] += c
    return tail(y * vel, 45)

def reverb_ir(rt60=1.0, predelay=0.012, bright=0.5, seed=3):
    """A small, soft room. Three frequency bands that decay at different speeds (highs vanish first), different on each ear."""
    rng = np.random.default_rng(seed)
    n = int((rt60 * 1.1 + predelay) * SR)
    t = np.arange(n) / SR
    out = np.zeros((n, 2))
    for ch in range(2):
        noise = rng.normal(0, 1, n)
        low, mid, high = lowpass(noise, 450, 1), bandpass(noise, 450, 3200, 1), highpass(noise, 3200, 1)
        env = lambda rt: np.exp(-6.9 * t / rt)
        tail = low * env(rt60 * 1.25) + mid * env(rt60) + high * env(rt60 * 0.45) * bright
        d = int(predelay * SR) + ch * int(0.0017 * SR)
        out[d:, ch] = tail[: n - d]
    # a few early reflections give the room some shape
    for ms, g, ch in [(7, 0.5, 0), (11, 0.42, 1), (17, 0.32, 0), (23, 0.28, 1), (31, 0.2, 0)]:
        out[int(ms / 1000 * SR), ch] += g * 12
    out[:, 0] *= 1.0; out[:, 1] *= 1.0
    out /= np.sqrt(np.sum(out ** 2) / 2)
    return out

_IRS = {}
def verb(x, wet=0.25, rt60=1.0, bright=0.5, seed=3):
    """Dry/wet reverb on a stereo signal. Adds the room's tail after the end of the sound."""
    key = (rt60, bright, seed)
    if key not in _IRS: _IRS[key] = reverb_ir(rt60, bright=bright, seed=seed)
    ir = _IRS[key]
    tail = int(rt60 * 1.0 * SR)
    pad = np.concatenate([x, np.zeros((tail, 2))], axis=0)
    w = np.stack([signal.fftconvolve(pad[:, 0], ir[:, 0])[: len(pad)], signal.fftconvolve(pad[:, 1], ir[:, 1])[: len(pad)]], axis=1)
    w *= np.sqrt(np.mean(pad ** 2) + 1e-12) / (np.sqrt(np.mean(w ** 2)) + 1e-12)   # same loudness as the dry sound
    return pad * (1 - wet * 0.55) + w * wet

def finish(x, name, trim_db=-58):
    """Last touches: remove rumble, trim silence at the end, fade out, set the peak level."""
    if x.ndim == 1: x = pan(x, 0)
    x = highpass(x, 28, 1)
    env = np.max(np.abs(x), axis=1)
    keep = np.where(env > 10 ** (trim_db / 20))[0]
    if len(keep): x = x[: keep[-1] + 1]
    x = fade(x, 0.0015, min(0.12, len(x) / SR * 0.3))
    x = np.tanh(x * 1.0)
    peak = np.max(np.abs(x)) + 1e-9
    x = x / peak * (10 ** (LEVELS.get(name, -12) / 20))
    return x

# ───────────────────────── the sounds ─────────────────────────

def s_tap(f, seed):
    r = np.random.default_rng(seed)
    y = strike(f, 0.12, "wood", rng=r, attack=0.001, click=0.8)
    low = strike(f * 0.27, 0.09, "felt", rng=r, attack=0.002) * 0.33
    y[: len(low)] += low
    return verb(pan(lowpass(y, 5200), r.uniform(-0.15, 0.15)), wet=0.12, rt60=0.35)

def s_pop(f, seed):
    r = np.random.default_rng(seed)
    t = tarr(0.5)
    y = strike(f, 0.5, "marimba", rng=r, ringscale=0.75)
    # a hint of upward bend at the very start, like a soft bubble
    bend = np.sin(TAU * np.cumsum(f * (1 + 0.035 * np.exp(-t / 0.012))) / SR) * np.exp(-t / 0.05) * 0.12
    return verb(pan(lowpass(y + bend, 7000), r.uniform(-0.2, 0.2)), wet=0.2, rt60=0.6)

def s_add():
    r = np.random.default_rng(11)
    buf = np.zeros((1, 2))
    for f, at, v in [(783.99, 0.0, 0.85), (1174.66, 0.085, 1.0)]:
        n = msum(strike(f, 0.9, "marimba", vel=v, rng=r, ringscale=1.1), 0.35 * strike(f * 2, 0.5, "celesta", vel=v, rng=r))
        buf = mix_into(buf, pan(lowpass(n, 8000), -0.1 if at == 0 else 0.12), at)
    return verb(buf, wet=0.26, rt60=0.9)

def s_done():
    r = np.random.default_rng(21)
    buf = np.zeros((1, 2))
    notes = [(523.25, 0.00, 0.8), (659.25, 0.075, 0.85), (783.99, 0.15, 0.95), (1046.5, 0.235, 1.1)]
    for i, (f, at, v) in enumerate(notes):
        n = msum(strike(f, 1.8, "celesta", vel=v, rng=r, ringscale=1.5), 0.3 * strike(f, 1.4, "marimba", vel=v, rng=r))
        buf = mix_into(buf, pan(lowpass(n, 9000), [-0.3, -0.1, 0.1, 0.3][i]), at)
    # a last faint shimmer an octave up, so the ending feels finished
    buf = mix_into(buf, pan(0.22 * strike(2093.0, 1.4, "glass", rng=r, ringscale=1.4), 0.2), 0.25)
    return verb(buf, wet=0.34, rt60=1.25)

def s_undo():
    r = np.random.default_rng(31)
    buf = np.zeros((1, 2))
    for f, at, v in [(659.25, 0.0, 0.9), (493.88, 0.075, 0.8)]:
        buf = mix_into(buf, pan(lowpass(strike(f, 0.55, "marimba", vel=v, rng=r, ringscale=0.9), 3200), 0.0), at)
    return verb(buf, wet=0.2, rt60=0.6)

def s_send():
    r = np.random.default_rng(41)
    t = tarr(0.22)
    sweep = bandpass(r.normal(0, 1, len(t)), 1500, 6500, 1) * np.sin(np.pi * t / 0.22) ** 2 * 0.2
    buf = pan(sweep, 0.0)
    buf = mix_into(buf, pan(lowpass(strike(1760.0, 0.7, "glass", rng=r, ringscale=0.7), 5200) * 0.8, 0.15), 0.1)
    return verb(buf, wet=0.28, rt60=0.8)

def s_err():
    r = np.random.default_rng(51)
    buf = np.zeros((1, 2))
    for f, at, v in [(196.0, 0.0, 1.0), (155.56, 0.11, 0.9)]:
        n = strike(f, 0.5, "felt", vel=v, rng=r, attack=0.004, ringscale=1.4, click=0.2)
        n = lowpass(n, 1500)
        buf = mix_into(buf, pan(n, 0.0), at)
    return verb(buf, wet=0.15, rt60=0.45)

def s_bell():
    r = np.random.default_rng(61)
    n = strike(1318.5, 2.6, "bell", rng=r, attack=0.004, ringscale=1.0)
    return verb(pan(lowpass(n, 7000), 0.0), wet=0.3, rt60=1.5)

def s_rip(seed):
    r = np.random.default_rng(seed)
    dur = 0.34
    n = int(dur * SR)
    t = np.arange(n) / SR
    fibres = np.abs(lowpass(r.normal(0, 1, n), 140, 2))              # the uneven pull of paper fibres
    fibres = (fibres / fibres.max()) ** 1.7
    out = np.zeros((n, 2))
    for ch in range(2):
        noise = bandpass(r.normal(0, 1, n), 1800, 7200, 2)
        crackle = np.zeros(n)
        idx = r.integers(0, n, 70)
        crackle[idx] = r.normal(0, 1, 70) * 1.5
        crackle = bandpass(crackle, 2500, 9000, 1)
        out[:, ch] = (noise * fibres + crackle * 0.5)
    env = np.minimum(1, t / 0.03) * np.exp(-((t - 0.1) / 0.2) ** 2) * (1 - np.exp(-(dur - t) / 0.03))
    out *= env[:, None]
    return verb(out, wet=0.12, rt60=0.4)

def s_whoosh():
    r = np.random.default_rng(81)
    dur = 0.62
    n = int(dur * SR)
    t = np.arange(n) / SR
    noise = r.normal(0, 1, n)
    out = np.zeros(n)
    block, hop = 2048, 1024
    win = np.hanning(block)
    for s in range(0, n - block, hop):
        p = (s + block / 2) / n
        fc = 380 + 2100 * np.sin(np.pi * p) ** 1.3
        seg = bandpass(noise[s:s + block], fc * 0.6, fc * 1.5, 2) * win
        out[s:s + block] += seg
    out *= np.sin(np.pi * t / dur) ** 2
    pans = np.sin(np.pi * t / dur) * 0 + (t / dur * 1.2 - 0.6)       # glides from left to right
    a = (pans + 1) * np.pi / 4
    return verb(np.stack([out * np.cos(a), out * np.sin(a)], axis=1), wet=0.2, rt60=0.7)

def s_stamp():
    r = np.random.default_rng(91)
    t = tarr(0.5)
    # the body of the thump: a low tone that drops in pitch as the rubber compresses
    f = 52 + 48 * np.exp(-t / 0.035)
    body = np.sin(TAU * np.cumsum(f) / SR) * np.exp(-t / 0.085)
    # the wooden handle and block knocking on the desk
    knock = strike(300.0, 0.3, "wood", rng=r, attack=0.001, ringscale=1.6, click=1.0) * 0.8
    # the flat slap of paper under the rubber
    slap = bandpass(r.normal(0, 1, len(t)), 900, 3600, 2) * np.exp(-t / 0.012) * 0.55
    # and the soft "shh" of ink squeezing out
    ink = bandpass(r.normal(0, 1, len(t)), 2500, 6500, 2) * np.minimum(1, t / 0.01) * np.exp(-t / 0.05) * 0.1
    y = msum(body, knock * 0.7, slap, ink)
    return verb(pan(lowpass(y, 8000), 0.0), wet=0.16, rt60=0.35)

def s_lift():
    r = np.random.default_rng(101)
    n = int(0.16 * SR)
    t = np.arange(n) / SR
    peel = bandpass(r.normal(0, 1, n), 1100, 4200, 2) * (t / 0.16) ** 1.4 * np.exp(-((t - 0.15) / 0.02) ** 2 * 0.0)
    peel *= 1 - np.exp(-(0.16 - t) / 0.006)
    pop = strike(210.0, 0.12, "felt", rng=r, attack=0.002) * 0.7
    buf = np.zeros((n, 2)) + pan(peel * 0.5, 0.1)
    buf = mix_into(buf, pan(pop, 0.0), 0.15)
    return verb(buf, wet=0.12, rt60=0.4)

def s_boxopen():
    r = np.random.default_rng(111)
    n = int(0.42 * SR)
    t = np.arange(n) / SR
    flap = bandpass(r.normal(0, 1, n), 380, 3200, 2) * (np.abs(lowpass(r.normal(0, 1, n), 90)) ** 1.2) * np.sin(np.pi * np.minimum(1, t / 0.42)) ** 0.8
    flap /= np.max(np.abs(flap)) + 1e-9
    buf = pan(flap * 0.55, -0.1)
    thump = tail(np.sin(TAU * np.cumsum(70 + 50 * np.exp(-tarr(0.25) / 0.04)) / SR) * np.exp(-tarr(0.25) / 0.07), 40)
    buf = mix_into(buf, pan(thump * 0.8, 0.0), 0.07)
    for f, at, v, p in [(659.25, 0.26, 0.85, -0.2), (987.77, 0.35, 0.9, 0.0), (1318.5, 0.45, 1.0, 0.2), (1975.5, 0.56, 0.5, 0.1)]:
        buf = mix_into(buf, pan(strike(f, 1.6, "celesta", vel=v, rng=r, ringscale=1.5), p), at)
    return verb(buf, wet=0.34, rt60=1.3)

def s_schoolbell():
    r = np.random.default_rng(121)
    buf = np.zeros((1, 2))
    for i in range(9):
        f = 1046.5 if i % 2 == 0 else 1052.0                         # two strikes a hair apart: the shimmer of a real bell
        v = 1.0 - 0.04 * i
        buf = mix_into(buf, pan(strike(f, 1.4, "bell", vel=v, rng=r, ringscale=0.55), -0.15 if i % 2 else 0.15), i * 0.13)
    return verb(buf, wet=0.28, rt60=1.2)

# ───────────────────────── music ─────────────────────────

def midi(n): return 440.0 * 2 ** ((n - 69) / 12)

def rhodes(f, dur, vel, rng):
    """A soft electric piano: two tones frequency-modulating each other, with a short bark at the start."""
    t = tarr(dur + 1.8)
    idx = (0.9 + 1.6 * vel) * np.exp(-t / 0.55)
    car = np.sin(TAU * f * t + idx * np.sin(TAU * f * t))
    bark = 0.25 * np.sin(TAU * f * t + 2.0 * vel * np.exp(-t / 0.035) * np.sin(TAU * f * 14 * t)) * np.exp(-t / 0.07)
    amp = np.exp(-t / (1.7 * (260.0 / f) ** 0.25))
    gate = np.where(t < dur, 1.0, np.exp(-(t - dur) / 0.28))
    return (car + bark) * amp * gate * np.minimum(1, t / 0.006) * vel

def render_music(report=False):
    rng = np.random.default_rng(2026)
    BPM = 72
    beat = 60.0 / BPM
    bar = beat * 4
    # chords as MIDI notes (a gentle, jazzy-calm progression in C)
    C = {
        "Cmaj9": [48, 55, 59, 62, 64], "Am9": [45, 55, 59, 60, 64], "Dm9": [50, 57, 60, 64, 65], "G13": [43, 53, 59, 62, 64],
        "Em7": [52, 55, 59, 62, 64], "Fmaj9": [53, 57, 60, 64, 67], "G7sus": [43, 53, 57, 60, 62], "Dm7": [50, 57, 60, 64, 65],
    }
    A = ["Cmaj9", "Am9", "Dm9", "G13", "Em7", "Am9", "Fmaj9", "G7sus"]
    B = ["Fmaj9", "Em7", "Dm7", "G13", "Cmaj9", "Am9", "Dm9", "G7sus"]
    prog = A + A + B
    n_bars = len(prog)
    L = n_bars * bar
    TAIL = 8.0
    N = int((L + TAIL) * SR)
    mus = np.zeros((N, 2))
    pent = [72, 74, 76, 79, 81, 84, 86]            # C major pentatonic, with a 9th, for the sparse melody

    def add(x, at, pan_pos, gain):
        nonlocal mus
        i = int(round(at * SR))
        if i < 0: x, i = x[-i:], 0          # a note "played" a hair early at the very start is simply cut
        if i >= N: return
        x = x[: N - i]
        s = pan(tail(x, 25), pan_pos) * gain
        mus[i:i + len(s)] += s

    for b, name in enumerate(prog):
        t0 = b * bar
        notes = C[name]
        # soft pad under the chord (slow swell)
        padlen = bar + 1.2
        tt = tarr(padlen)
        swell = np.minimum(1, tt / 1.1) * np.exp(-np.maximum(0, tt - bar) / 0.5)
        for k, m in enumerate(notes):
            tone = (np.sin(TAU * midi(m) * 1.0015 * tt) + np.sin(TAU * midi(m) * 0.9985 * tt)) * 0.5
            add(lowpass(tone, 1100) * swell, t0, -0.5 + 0.25 * k, 0.012)
        # the electric piano chord, gently rolled (strummed) from the bottom up, played on beat 1 and the "and" of 2
        for hit, (pos, vel) in enumerate([(0.0, 0.62), (1.5, 0.42)]):
            if hit == 1 and b % 4 == 3: continue
            for k, m in enumerate(notes[1:]):
                at = t0 + pos * beat + k * 0.018 + rng.normal(0, 0.006)
                x = rhodes(midi(m + 12), beat * (3.0 if hit == 0 else 2.0), vel * rng.uniform(0.85, 1.0), rng)
                add(lowpass(x, 4200), at, -0.35 + 0.18 * k, 0.05)
        # a quiet bass: root on beat 1, a softer one on the "and" of 3
        root = notes[0] if notes[0] < 52 else notes[0] - 12
        for pos, vel in [(0.0, 1.0), (2.5, 0.55)]:
            tt = tarr(beat * 1.6)
            f = midi(root)
            x = (np.sin(TAU * f * tt) + 0.22 * np.sin(TAU * 2 * f * tt)) * np.exp(-tt / 0.55) * np.minimum(1, tt / 0.015) * vel
            add(x, t0 + pos * beat + rng.normal(0, 0.004), 0.0, 0.1)
        # sparse melody, played softly
        for step in range(8):
            if rng.random() < 0.3 and step not in (0,):
                m = int(rng.choice(pent))
                at = t0 + step * beat / 2 + (0.03 if step % 2 else 0) + rng.normal(0, 0.008)
                x = strike(midi(m), 1.6, "celesta", vel=rng.uniform(0.35, 0.6), rng=rng, ringscale=1.2)
                add(lowpass(x, 5500), at, float(rng.uniform(-0.5, 0.5)), 0.05)
        # very soft kick on 1 and a brushed hat on the off-beats (with a lazy swing)
        for pos in (0.0, 2.0):
            tt = tarr(0.22)
            f = 52 + 38 * np.exp(-tt / 0.03)
            x = np.sin(TAU * np.cumsum(f) / SR) * np.exp(-tt / 0.07) * (1 if pos == 0 else 0.7)
            add(x, t0 + pos * beat, 0.0, 0.07)
        for step in range(8):
            tt = tarr(0.07)
            x = highpass(rng.normal(0, 1, len(tt)), 6000, 1) * np.exp(-tt / 0.018) * (1.0 if step % 2 else 0.45)
            add(x, t0 + step * beat / 2 + (0.035 if step % 2 else 0), 0.25 if step % 2 else -0.25, 0.008)

    # room + warmth
    mus = verb(mus, wet=0.22, rt60=1.6, bright=0.35)[:N]
    # fold the tail back onto the start so the loop joins without a gap
    loop_n = int(L * SR)
    body = mus[:loop_n].copy()
    over = mus[loop_n:]
    body[: len(over)] += over[: len(body)]
    # old-record feel: a whisper of crackle and hiss, then gentle tape-style softening
    n = len(body)
    crackle = np.zeros(n)
    idx = rng.integers(0, n, int(L * 6))
    crackle[idx] = rng.normal(0, 1, len(idx)) * rng.uniform(0.2, 1.0, len(idx))
    crackle = bandpass(crackle, 1800, 9000, 1) * 0.0035
    hiss = lowpass(highpass(rng.normal(0, 1, n), 3000, 1), 9000, 1) * 0.0007
    body += np.stack([crackle + hiss, np.roll(crackle, 3000) + hiss], axis=1)
    body = lowpass(body, 6800, 1)
    body = np.tanh(body * 1.8) / 1.8
    body = highpass(body, 35, 1)
    # leave the loop quiet at its very edges so a decoder's tiny padding can't click
    body = fade(body, 0.02, 0.02)
    peak = np.max(np.abs(body))
    body = body / peak * 10 ** (-7.5 / 20)
    return body

# ───────────────────────── output ─────────────────────────

def write_wav(path, x):
    pcm = (np.clip(x, -1, 1) * 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(pcm.tobytes())

def write_mp3(path, x, quality=2):
    """Save as mp3 (through a temporary wav). ffmpeg writes the encoder-delay info that browsers use to start the sound on time."""
    tmp = path[:-4] + "._tmp.wav"
    write_wav(tmp, x)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", tmp, "-c:a", "libmp3lame", "-q:a", str(quality), "-ar", str(SR), "-ac", "2", path], check=True)
    os.remove(tmp)

def main():
    report = "--report" in sys.argv
    os.makedirs(OUT, exist_ok=True)
    sounds = {
        "tap1": s_tap(1000, 1), "tap2": s_tap(940, 2), "tap3": s_tap(1070, 3),
        "pop1": s_pop(1318.5, 4), "pop2": s_pop(1174.7, 5), "pop3": s_pop(1568.0, 6),
        "add": s_add(), "done": s_done(), "undo": s_undo(), "send": s_send(), "err": s_err(), "bell": s_bell(),
        "rip1": s_rip(7), "rip2": s_rip(8), "rip3": s_rip(9), "whoosh": s_whoosh(), "stamp": s_stamp(), "lift": s_lift(),
        "boxOpen": s_boxopen(), "schoolbell": s_schoolbell(),
    }
    stats = []
    for name, x in sounds.items():
        y = finish(x, name)
        write_mp3(os.path.join(OUT, name + ".mp3"), y)
        rms = 20 * np.log10(np.sqrt(np.mean(y ** 2)) + 1e-12)
        stats.append((name, len(y) / SR, 20 * np.log10(np.max(np.abs(y))), rms))
    music = render_music(report)
    write_mp3(os.path.join(OUT, "music.mp3"), music, quality=3)
    stats.append(("music", len(music) / SR, 20 * np.log10(np.max(np.abs(music))), 20 * np.log10(np.sqrt(np.mean(music ** 2)))))
    total = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
    print(f"wrote {len(stats)} files, {total / 1024:.0f} KB, to {os.path.abspath(OUT)}")
    if report:
        print(f"{'name':12s} {'sec':>6s} {'peak dB':>8s} {'rms dB':>8s}")
        for n, d, p, r in stats: print(f"{n:12s} {d:6.2f} {p:8.1f} {r:8.1f}")

if __name__ == "__main__":
    main()
