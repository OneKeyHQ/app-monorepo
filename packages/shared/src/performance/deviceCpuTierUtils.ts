export function normalizeDeviceCpuTierKeyPart(value: string | null): string {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}
