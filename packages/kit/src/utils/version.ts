function formatVersion(version: string): string {
  return version.replace('V', '').replace('v', '');
}

/**
 *
 * @param version1
 * @param version2
 * @returns -1: version1 < version2 ; 0: version1 = version2 ; 1: version1 > version2
 */
export function compVersion(version1: string, version2: string): number {
  const arr1 = formatVersion(version1).split('.');
  const arr2 = formatVersion(version2).split('.');

  const len = Math.max(arr1.length, arr2.length);
  for (let i = 0; i < len; ) {
    if (arr1[i] === arr2[i]) {
      i += 1;
    } else if (!arr1[i] || arr1[i] < arr2[i]) {
      return -1;
    } else {
      return 1;
    }
  }
  return 0;
}
