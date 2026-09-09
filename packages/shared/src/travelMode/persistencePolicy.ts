import { LOCALE_KEYS } from '../locale/localeLoaders';

const TRAVEL_MODE_PASSWORD_READABLE_FIELDS = [
  'isPasswordSet',
  'passwordMode',
  'isPasscodeModeFixed',
  'appLockDuration',
  'enableSystemIdleLock',
  'passwordErrorAttempts',
  'passwordErrorProtectionTime',
] as const;

const TRAVEL_MODE_SETTINGS_FIELDS = [
  'currencyInfo',
  'hapticFeedbackEnabled',
  'locale',
  'theme',
] as const;

const TRAVEL_MODE_LOCALES = new Set<string>(['system', ...LOCALE_KEYS]);

const TRAVEL_MODE_PASSWORD_WRITABLE_FIELDS = [
  'appLockDuration',
  'enableSystemIdleLock',
  'passwordErrorAttempts',
  'passwordErrorProtectionTime',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidPasswordControlField(key: string, value: unknown): boolean {
  switch (key) {
    case 'isPasswordSet':
      return typeof value === 'boolean';
    case 'passwordMode':
      return value === 'passcode' || value === 'password';
    case 'isPasscodeModeFixed':
      return typeof value === 'boolean';
    case 'appLockDuration':
      return typeof value === 'number' && Number.isFinite(value) && value >= 0;
    case 'enableSystemIdleLock':
      return typeof value === 'boolean';
    case 'passwordErrorAttempts':
    case 'passwordErrorProtectionTime':
      return typeof value === 'number' && Number.isFinite(value) && value >= 0;
    default:
      return false;
  }
}

function isValidCurrencyInfo(
  value: unknown,
): value is { id: string; symbol: string } {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.symbol === 'string' &&
    value.symbol.length > 0
  );
}

function isValidSettingsControlField(key: string, value: unknown): boolean {
  switch (key) {
    case 'currencyInfo':
      return isValidCurrencyInfo(value);
    case 'hapticFeedbackEnabled':
      return typeof value === 'boolean';
    case 'locale':
      return typeof value === 'string' && TRAVEL_MODE_LOCALES.has(value);
    case 'theme':
      return value === 'light' || value === 'dark' || value === 'system';
    default:
      return false;
  }
}

function cloneSettingsControlField(key: string, value: unknown): unknown {
  return key === 'currencyInfo' && isValidCurrencyInfo(value)
    ? { id: value.id, symbol: value.symbol }
    : value;
}

export function buildTravelModePasswordPersistView({
  initialValue,
  persistedValue,
}: {
  initialValue: unknown;
  persistedValue: unknown;
}): unknown {
  if (!isRecord(persistedValue)) {
    return initialValue;
  }
  const result: Record<string, unknown> = isRecord(initialValue)
    ? { ...initialValue }
    : {};
  for (const key of TRAVEL_MODE_PASSWORD_READABLE_FIELDS) {
    const value = persistedValue[key];
    if (isValidPasswordControlField(key, value)) {
      result[key] = value;
    }
  }
  return result;
}

export function mergeTravelModePasswordPersistWrite({
  persistedValue,
  proposedValue,
}: {
  persistedValue: unknown;
  proposedValue: unknown;
}): unknown {
  if (!isRecord(persistedValue) || !isRecord(proposedValue)) {
    return persistedValue;
  }
  const result: Record<string, unknown> = { ...persistedValue };
  for (const key of TRAVEL_MODE_PASSWORD_WRITABLE_FIELDS) {
    const value = proposedValue[key];
    if (isValidPasswordControlField(key, value)) {
      result[key] = value;
    }
  }
  return result;
}

export function buildTravelModeManualLockPersistView({
  initialValue,
  persistedValue,
}: {
  initialValue: unknown;
  persistedValue: unknown;
}): unknown {
  if (
    !isRecord(persistedValue) ||
    typeof persistedValue.manualLocking !== 'boolean'
  ) {
    return initialValue;
  }
  return {
    ...(isRecord(initialValue) ? initialValue : {}),
    manualLocking: persistedValue.manualLocking,
  };
}

export function mergeTravelModeManualLockPersistWrite({
  persistedValue,
  proposedValue,
}: {
  persistedValue: unknown;
  proposedValue: unknown;
}): unknown {
  const currentValue =
    isRecord(persistedValue) &&
    typeof persistedValue.manualLocking === 'boolean'
      ? { manualLocking: persistedValue.manualLocking }
      : undefined;
  if (
    !isRecord(proposedValue) ||
    typeof proposedValue.manualLocking !== 'boolean'
  ) {
    return currentValue;
  }
  return { manualLocking: proposedValue.manualLocking };
}

export function buildTravelModeSettingsPersistView({
  initialValue,
  persistedValue,
}: {
  initialValue: unknown;
  persistedValue: unknown;
}): unknown {
  if (!isRecord(persistedValue)) {
    return initialValue;
  }
  const result: Record<string, unknown> = isRecord(initialValue)
    ? { ...initialValue }
    : {};
  for (const key of TRAVEL_MODE_SETTINGS_FIELDS) {
    const value = persistedValue[key];
    if (isValidSettingsControlField(key, value)) {
      result[key] = cloneSettingsControlField(key, value);
    }
  }
  return result;
}

export function mergeTravelModeSettingsPersistWrite({
  persistedValue,
  proposedValue,
}: {
  persistedValue: unknown;
  proposedValue: unknown;
}): unknown {
  if (!isRecord(proposedValue)) {
    return persistedValue;
  }
  const result: Record<string, unknown> = isRecord(persistedValue)
    ? { ...persistedValue }
    : {};
  for (const key of TRAVEL_MODE_SETTINGS_FIELDS) {
    const value = proposedValue[key];
    if (isValidSettingsControlField(key, value)) {
      result[key] = cloneSettingsControlField(key, value);
    }
  }
  return result;
}

export function buildTravelModeCurrencyReferenceView({
  initialValue,
  persistedValue,
}: {
  initialValue: unknown;
  persistedValue: unknown;
}): unknown {
  if (!isRecord(persistedValue) || !isRecord(persistedValue.currencyMap)) {
    return initialValue;
  }
  return {
    currencyMap: { ...persistedValue.currencyMap },
  };
}
