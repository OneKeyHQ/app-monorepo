const FALLBACK_TIME_ZONE = 'Etc/UTC';

export function getDeviceTimeZone(preferredTimeZone?: string | null): string {
  if (preferredTimeZone) {
    return preferredTimeZone;
  }

  try {
    return (
      Intl.DateTimeFormat().resolvedOptions().timeZone || FALLBACK_TIME_ZONE
    );
  } catch {
    return FALLBACK_TIME_ZONE;
  }
}

export function getDeviceUtcOffsetMinutes(): number {
  // Date#getTimezoneOffset uses the inverse sign of conventional UTC offsets.
  return -new Date().getTimezoneOffset();
}
