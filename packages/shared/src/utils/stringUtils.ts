import safeStringify from 'fast-safe-stringify';

export function equalsIgnoreCase(
  a: string | undefined | null,
  b: string | undefined | null,
): boolean {
  return a?.toUpperCase() === b?.toUpperCase();
}

export function stableStringify(
  value: any,
  replacer?: (key: string, value: any) => any,
  space?: string | number,
  options?: { depthLimit: number | undefined; edgesLimit: number | undefined },
): string {
  return safeStringify.stableStringify(value, replacer, space, options);
}
