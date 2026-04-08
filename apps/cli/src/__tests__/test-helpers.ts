/**
 * Extract parseable JSON from CLI output that may contain debug log lines
 * (e.g., isExtensionBackgroundServiceWorker from shared package).
 * Tries each line (last-to-first) to find one that parses as JSON.
 */
export function extractJson(raw: string): string {
  const lines = raw.split('\n');
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i].trim();
    if (
      (line.startsWith('{') && line.endsWith('}')) ||
      (line.startsWith('[') && line.endsWith(']'))
    ) {
      try {
        JSON.parse(line);
        return line;
      } catch {
        // not valid JSON, try next line
      }
    }
  }
  return raw;
}

/**
 * Strip debug noise from CLI output for non-JSON assertions.
 * Removes lines that start with known debug prefixes.
 */
export function stripDebugOutput(raw: string): string {
  // The debug block looks like:
  //   isExtensionBackgroundServiceWorker {
  //     _isExtensionBackgroundServiceWorker: false,
  //     _isExtensionBackgroundHtml: false
  //   }
  // Remove it as a whole, then strip deprecation warnings.
  const cleaned = raw
    .replace(/isExtensionBackgroundServiceWorker\s*\{[\s\S]*?\}/g, '')
    .split('\n')
    .filter((line) => !line.includes('DeprecationWarning'))
    .join('\n')
    .trim();
  return cleaned;
}
