// semverExtensions.ts
import semver from 'semver';

import type { ReleaseType, SemVer } from 'semver';

function compareIgnore(
  v1: string | SemVer,
  v2: string | SemVer,
  type: ReleaseType,
  comparator: (v1: string, v2: string) => boolean,
): boolean {
  const version1 = semver.parse(v1);
  const version2 = semver.parse(v2);

  if (version1 === null || version2 === null) {
    return false;
  }

  if (type === 'major') {
    throw new Error('major is not supported');
  }

  if (type === 'minor') {
    version1.minor = 0;
    version2.minor = 0;
  }

  if (type === 'minor' || type === 'patch') {
    version1.patch = 0;
    version2.patch = 0;
  }

  return comparator(version1.format(), version2.format());
}

const gteIgnore = (
  v1: string | SemVer,
  v2: string | SemVer,
  type: ReleaseType,
) => compareIgnore(v1, v2, type, semver.gte);

const gtIgnore = (
  v1: string | SemVer,
  v2: string | SemVer,
  type: ReleaseType,
) => compareIgnore(v1, v2, type, semver.gt);

const lteIgnore = (
  v1: string | SemVer,
  v2: string | SemVer,
  type: ReleaseType,
) => compareIgnore(v1, v2, type, semver.lte);

const ltIgnore = (
  v1: string | SemVer,
  v2: string | SemVer,
  type: ReleaseType,
) => compareIgnore(v1, v2, type, semver.lt);

export { gteIgnore, gtIgnore, lteIgnore, ltIgnore };
