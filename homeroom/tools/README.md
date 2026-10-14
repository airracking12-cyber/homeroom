# tools/

Scripts and sources that make the sound and stamp files in `public/`. You only need them if you want to change how something sounds or looks; the finished files are already in `public/`.

| File | Makes | How |
|---|---|---|
| `render_sounds.py` | `public/sounds/v2/*.mp3` (all effects and the music loop) | `python3 tools/render_sounds.py --report` (needs numpy, scipy, ffmpeg) |
| `render_stamp_textures.py` | `public/stamp/v2/ink-wear.png`, `paper-fiber.png` | `python3 tools/render_stamp_textures.py` (needs numpy, scipy, opencv, Pillow) |
| `stamp-tool.svg` | the stamp picture (`public/stamp/v2/stamp-tool@1x..4x.png`) | open it in a browser to see it; it was rendered at 4x with a headless browser and shrunk to four sizes |

## Making one sound louder or quieter
Fastest, no re-render: change its number in `TRIM` at the top of `src/lib/sound.js` (1 is as rendered; 0.7 is a bit quieter; 1.4 is louder).

For a lasting change, edit its level in `LEVELS` in `render_sounds.py` (dB below full scale; -12 is louder than -18) and run the script.

## Changing a sound itself
Each sound is a small function in `render_sounds.py` (`s_done`, `s_stamp`, ...). The notes are MIDI-style pitches in Hz (`783.99` is G5); the instrument names (`"marimba"`, `"celesta"`, `"glass"`, `"bell"`) are in `KINDS`. After a change, run the script with `--report` to see each file's length and loudness.

If you re-render and want every device to download the new files instead of using a cached copy, change `VERSION` in `render_sounds.py` (for example `"v3"`) AND `SOUND_BASE` in `src/lib/sound.js` to match, and move the folder name to match in `public/_headers`. `npm test` checks that the two agree.

## The stamp
- Colour of the ink: `--ob-stamp` in `src/onboarding/onboarding.css.js` (the stamp's rubber edge in `stamp-tool.svg` uses the same teal, `#2f5566`).
- How it moves: `toolVariants` and `shadowVariants` in `src/onboarding/Stamp.jsx`, and the timings in `TIMING` there.
- The wording and layout of the mark: `InkArt` in the same file.
