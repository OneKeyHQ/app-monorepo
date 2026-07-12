export const DEVICE_CPU_TIER_KEY_SEPARATOR = '\u0000';

export function normalizeDeviceCpuTierKeyPart(value: string | null): string {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function buildAndroidDeviceCpuTierKey({
  manufacturer,
  model,
}: {
  manufacturer: string | null;
  model: string | null;
}): string {
  const normalizedManufacturer = normalizeDeviceCpuTierKeyPart(manufacturer);
  const normalizedModel = normalizeDeviceCpuTierKeyPart(model);
  if (!normalizedManufacturer || !normalizedModel) {
    return '';
  }
  return `${normalizedManufacturer}${DEVICE_CPU_TIER_KEY_SEPARATOR}${normalizedModel}`;
}
