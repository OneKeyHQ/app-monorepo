export type ISparkSerializable<T> = T extends bigint
  ? string
  : T extends Uint8Array
    ? number[]
    : T extends Map<unknown, infer V>
      ? Record<string, ISparkSerializable<V>>
      : T extends Array<infer U>
        ? ISparkSerializable<U>[]
        : T extends object
          ? { [P in keyof T]: ISparkSerializable<T[P]> }
          : T;

function convertValue(value: unknown): unknown {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (value instanceof Uint8Array) {
    return Array.from(value);
  }
  if (value instanceof Map) {
    return Object.fromEntries(
      Array.from(value, ([key, item]) => [String(key), convertValue(item)]),
    );
  }
  if (Array.isArray(value)) {
    return value.map(convertValue);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, convertValue(item)]),
    );
  }
  return value;
}

/**
 * Converts Breez SDK values into JSON-safe data: bigint becomes a decimal
 * string and Map becomes a plain object. The native main/bg RPC and the
 * logger both JSON.stringify payloads, which throws on bigint.
 */
export function toSparkSerializable<T>(value: T): ISparkSerializable<T> {
  return convertValue(value) as ISparkSerializable<T>;
}
