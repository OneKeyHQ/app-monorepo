import type { IPackageRef } from './checkPackageAge';

/**
 * Parse a `git diff` of yarn.lock to extract newly added packages.
 *
 * Yarn Berry lockfile entries look like:
 *   "package-name@npm:^1.0.0":
 *     version: 1.2.3
 *
 * Entry headers may use version ranges (^1.0.0, ~5.2.0, >=0.5.0), so we
 * match the header for the package name, then read the resolved version
 * from the +  version: line that follows (same approach as parseFullLockfile).
 */
export function parseLockfileDiff(diff: string): IPackageRef[] {
  const lines = diff.split('\n');
  const seen = new Set<string>();
  const results: IPackageRef[] = [];

  // Match added entry header lines like: +"lodash@npm:^4.0.0":
  const entryPattern = /^\+"(?:(@[^@]+\/[^@]+)|([^@"][^@]*))@npm:/;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const entryMatch = entryPattern.exec(line);
    if (entryMatch) {
      const name = entryMatch[1] || entryMatch[2];
      // Look for the version field in the next few added lines
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j += 1) {
        const versionMatch = /^\+\s+version:\s+(.+)$/.exec(lines[j]);
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
export function parseFullLockfile(content: string): IPackageRef[] {
  const lines = content.split('\n');
  const seen = new Set<string>();
  const results: IPackageRef[] = [];

  // Match entry header lines like: "lodash@npm:^4.0.0, lodash@npm:^4.17.0":
  const entryPattern = /^"(?:(@[^@]+\/[^@]+)|([^@"][^@]*))@npm:/;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const entryMatch = entryPattern.exec(line);
    if (entryMatch) {
      const name = entryMatch[1] || entryMatch[2];
      // Look for the version field in the next few lines
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j += 1) {
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
