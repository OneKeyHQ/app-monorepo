// Values cross the extension's runtime port as JSON, which has no bigint, Map
// or undefined, and the Breez SDK uses all three: amounts are bigint, getInfo
// returns token balances in a Map, and the service turns SDK defaults off by
// setting them to undefined, which a dropped key would turn back on. The tags
// below carry these values across, so each side gets the value the other
// side passed.

const BIGINT_TAG = '$sparkBigInt';
const MAP_TAG = '$sparkMap';
const UNDEFINED_TAG = '$sparkUndefined';

export function encodeSparkValue(value: unknown): unknown {
  if (value === undefined) {
    return { [UNDEFINED_TAG]: true };
  }
  if (typeof value === 'bigint') {
    return { [BIGINT_TAG]: value.toString() };
  }
  if (value instanceof Map) {
    return {
      [MAP_TAG]: Array.from(value, ([key, item]) => [
        encodeSparkValue(key),
        encodeSparkValue(item),
      ]),
    };
  }
  if (Array.isArray(value)) {
    return value.map(encodeSparkValue);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, encodeSparkValue(item)]),
    );
  }
  return value;
}

/**
 * Reverses encodeSparkValue. The caller states the type the other side
 * passed; the port does not check it.
 */
export function decodeSparkValue<T = unknown>(value: unknown): T {
  if (Array.isArray(value)) {
    return value.map((item) => decodeSparkValue(item)) as T;
  }
  if (!value || typeof value !== 'object') {
    return value as T;
  }
  const entries = Object.entries(value);
  if (entries.length === 1) {
    const [[key, item]] = entries;
    if (key === UNDEFINED_TAG) {
      return undefined as T;
    }
    if (key === BIGINT_TAG && typeof item === 'string') {
      return BigInt(item) as T;
    }
    if (key === MAP_TAG && Array.isArray(item)) {
      return new Map(
        (item as [unknown, unknown][]).map(([mapKey, mapItem]) => [
          decodeSparkValue(mapKey),
          decodeSparkValue(mapItem),
        ]),
      ) as T;
    }
  }
  return Object.fromEntries(
    entries.map(([key, item]) => [key, decodeSparkValue(item)]),
  ) as T;
}
