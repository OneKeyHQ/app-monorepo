import type { PackageRef } from './checkPackageAge';

/**
 * Parse a `git diff` of yarn.lock to extract newly added packages.
 *
 * Yarn Berry lockfile entries look like:
 *   "package-name@npm:1.2.3":
 *   "@scope/name@npm:1.2.3":
 *
 * In a diff, added lines start with "+". We match those lines and extract
 * the package name and version, then deduplicate.
 */
export function parseLockfileDiff(diff: string): PackageRef[] {
  // Match added lines containing a package entry.
  // Captures: (optional @scope/name or plain name) and (version after npm:)
  // Examples:
  //   +"lodash@npm:4.17.21":
  //   +"@babel/core@npm:7.24.0":
  //   +"@scope/name@npm:1.2.3, @scope/name@npm:^1.0.0":
  const pattern = /^\+"(?:(@[^@]+\/[^@]+)|([^@"][^@]*))@npm:(\d+\.\d+[^",]*)"?/gm;

  const seen = new Set<string>();
  const results: PackageRef[] = [];

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(diff)) !== null) {
    const name = match[1] || match[2];
    const version = match[3];
    const key = `${name}@${version}`;
    if (!seen.has(key)) {
      seen.add(key);
      results.push({ name, version });
    }
  }

  return results;
}

/**
 * Parse the full yarn.lock content (not a diff) and extract all packages.
 *
 * Yarn Berry lockfile entries look like:
 *   "package-name@npm:^1.0.0":
 *     version: 1.2.3
 *
 * We look for lines that define a package entry and then read the
 * resolved version from the `version:` field that follows.
 */
export function parseFullLockfile(content: string): PackageRef[] {
  const lines = content.split('\n');
  const seen = new Set<string>();
  const results: PackageRef[] = [];

  // Match entry header lines like: "lodash@npm:^4.0.0, lodash@npm:^4.17.0":
  const entryPattern = /^"(?:(@[^@]+\/[^@]+)|([^@"][^@]*))@npm:/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const entryMatch = entryPattern.exec(line);
    if (entryMatch) {
      const name = entryMatch[1] || entryMatch[2];
      // Look for the version field in the next few lines
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const versionMatch = /^\s+version:\s+(.+)$/.exec(lines[j]);
        if (versionMatch) {
          const version = versionMatch[1].trim();
          const key = `${name}@${version}`;
          if (!seen.has(key)) {
            seen.add(key);
            results.push({ name, version });
          }
          break;
        }
      }
    }
  }

  return results;
}
