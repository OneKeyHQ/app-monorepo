// Zstandard compression for .odb events files.
//
// Uses Node.js's built-in zstd implementation (node:zlib zstdCompress /
// zstdDecompress, available since Node 22). The package.json `engines.node`
// field already pins Node >=22, so this is always available — no external
// dependency, no native build step, no platform-specific prebuilts.
//
// Compression strategy: single zstd frame per file. Recordings buffer events
// in memory while active and write one frame on finalize. Multi-frame
// concatenation is intentionally avoided because Node's zstdDecompressSync /
// createZstdDecompress only decode the first frame of a concatenated stream
// without manual frame-boundary scanning.
import { zstdCompress, zstdDecompress, constants } from "node:zlib";
import { promisify } from "node:util";

const zstdCompressAsync = promisify(zstdCompress);
const zstdDecompressAsync = promisify(zstdDecompress);

// Default compression level: 3 (zstd's documented sweet spot for
// throughput-vs-ratio; matches the `zstd` CLI default).
const DEFAULT_LEVEL = 3;

let zstdAvailable: boolean | null = null;

async function probeZstd(): Promise<boolean> {
  if (zstdAvailable !== null) return zstdAvailable;
  try {
    await zstdCompressAsync(Buffer.from(""));
    zstdAvailable = true;
  } catch {
    zstdAvailable = false;
  }
  return zstdAvailable;
}

export async function bestAvailableCodec(): Promise<"zstd" | "none"> {
  return (await probeZstd()) ? "zstd" : "none";
}

export async function compressText(s: string): Promise<Uint8Array> {
  if (!(await probeZstd())) {
    throw new Error("zstd unavailable; cannot compress");
  }
  const out = await zstdCompressAsync(Buffer.from(s, "utf8"), {
    params: {
      [constants.ZSTD_c_compressionLevel]: DEFAULT_LEVEL,
    },
  });
  return new Uint8Array(out.buffer, out.byteOffset, out.byteLength);
}

export async function decompressToText(buf: Uint8Array): Promise<string> {
  if (!(await probeZstd())) {
    throw new Error("zstd unavailable; cannot decompress");
  }
  const out = await zstdDecompressAsync(buf);
  return out.toString("utf8");
}
