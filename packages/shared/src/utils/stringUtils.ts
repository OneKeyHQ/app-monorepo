export function equalsIgnoreCase(
  a: string | undefined | null,
  b: string | undefined | null,
): boolean {
  return a?.toUpperCase() === b?.toUpperCase();
}
