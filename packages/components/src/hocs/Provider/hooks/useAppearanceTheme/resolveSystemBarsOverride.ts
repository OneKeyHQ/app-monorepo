export type ISystemBarsVariant = 'light' | 'dark';

export const DEFAULT_SYSTEM_BARS_OVERRIDE_OWNER = 'default';

export function upsertSystemBarsOverridePin(
  pins: Map<string, ISystemBarsVariant>,
  owner: string,
  variant: ISystemBarsVariant | null,
): boolean {
  if (variant === null) {
    return pins.delete(owner);
  }
  if (pins.get(owner) === variant) {
    return false;
  }
  pins.set(owner, variant);
  return true;
}

export function resolveSystemBarsOverride(
  pins: Iterable<ISystemBarsVariant>,
): ISystemBarsVariant | null {
  let hasLight = false;
  for (const variant of pins) {
    if (variant === 'dark') {
      return 'dark';
    }
    if (variant === 'light') {
      hasLight = true;
    }
  }
  return hasLight ? 'light' : null;
}
