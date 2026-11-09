/** Keep a UTF-8 suffix without starting in the middle of a log line. */
export function recentLogBytes(
  bytes: Uint8Array<ArrayBuffer>,
  limit: number,
): Uint8Array<ArrayBuffer> {
  if (bytes.length <= limit) return bytes;
  let start = bytes.length - limit;
  if (bytes[start - 1] !== 10) {
    const newline = bytes.indexOf(10, start);
    start = newline < 0 ? bytes.length : newline + 1;
  }
  return bytes.subarray(start);
}
