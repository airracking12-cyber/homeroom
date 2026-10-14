// Identifies an image by its first bytes instead of trusting the file's claimed type (which the browser takes
// from the file name and which anyone can fake). Returns a MIME type, or null when the bytes are not a known image.

const ascii = (b, start, len) => String.fromCharCode(...b.slice(start, start + len));
const HEIC_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "hevm", "hevs", "mif1", "msf1"]);

export function sniffImageType(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && ascii(b, 1, 3) === "PNG" && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "image/png";
  if (b.length >= 6 && (ascii(b, 0, 6) === "GIF87a" || ascii(b, 0, 6) === "GIF89a")) return "image/gif";
  if (b.length >= 12 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") return "image/webp";
  if (b.length >= 12 && ascii(b, 4, 4) === "ftyp" && HEIC_BRANDS.has(ascii(b, 8, 4))) return "image/heic";
  return null;
}

// Reads only the first 32 bytes of a File or Blob.
export async function sniffFile(file) {
  return sniffImageType(new Uint8Array(await file.slice(0, 32).arrayBuffer()));
}
