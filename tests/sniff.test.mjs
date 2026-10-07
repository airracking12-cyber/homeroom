import test from "node:test";
import assert from "node:assert/strict";
import { sniffImageType, sniffFile } from "../src/sniffImage.js";

const text = (s) => [...s].map((c) => c.charCodeAt(0));
const pad = (arr, n = 32) => Uint8Array.from([...arr, ...new Array(Math.max(0, n - arr.length)).fill(0)]);

test("recognises real image headers", () => {
  assert.equal(sniffImageType(pad([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
  assert.equal(sniffImageType(pad([0x89, ...text("PNG"), 0x0d, 0x0a, 0x1a, 0x0a])), "image/png");
  assert.equal(sniffImageType(pad(text("GIF89a"))), "image/gif");
  assert.equal(sniffImageType(pad([...text("RIFF"), 1, 2, 3, 4, ...text("WEBP")])), "image/webp");
  assert.equal(sniffImageType(pad([0, 0, 0, 24, ...text("ftypheic")])), "image/heic");
  assert.equal(sniffImageType(pad([0, 0, 0, 24, ...text("ftypmif1")])), "image/heic");
});

test("refuses things that are not images, whatever they claim to be", () => {
  assert.equal(sniffImageType(pad(text("<html><script>alert(1)</script>"))), null);
  assert.equal(sniffImageType(pad(text("%PDF-1.7"))), null);
  assert.equal(sniffImageType(pad([...text("RIFF"), 1, 2, 3, 4, ...text("WAVE")])), null, "RIFF audio is not WebP");
  assert.equal(sniffImageType(pad([0, 0, 0, 24, ...text("ftypisom")])), null, "an MP4 video is not an image");
  assert.equal(sniffImageType(new Uint8Array([])), null);
  assert.equal(sniffImageType(new Uint8Array([0xff, 0xd8])), null, "too short to be a JPEG");
  assert.equal(sniffImageType(undefined), null);
});

test("sniffFile reads a Blob and ignores its claimed type", async () => {
  const fake = new Blob([pad(text("<html>"))], { type: "image/png" });
  assert.equal(await sniffFile(fake), null);
  const real = new Blob([pad([0xff, 0xd8, 0xff, 0xdb])], { type: "text/plain" });
  assert.equal(await sniffFile(real), "image/jpeg");
});
