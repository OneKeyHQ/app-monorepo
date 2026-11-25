// ============ JSON Utilities (BigInt/Map/Set-aware) ============

const BIGINT_PREFIX = "__bigint__:";
const MAP_MARKER = "__map__";
const SET_MARKER = "__set__";

/**
 * JSON.stringify replacement that handles BigInt, Map, and Set.
 * - BigInts → { "__bigint__": "12345" }
 * - Maps → { "__map__": [[key, value], ...] }
 * - Sets → { "__set__": [value, ...] }
 */
export function jsonStringify(value: unknown): string {
  return JSON.stringify(value, (_key, val) => {
    if (typeof val === "bigint") {
      return { [BIGINT_PREFIX]: val.toString() };
    }
    if (val instanceof Map) {
      return { [MAP_MARKER]: Array.from(val.entries()) };
    }
    if (val instanceof Set) {
      return { [SET_MARKER]: Array.from(val) };
    }
    return val;
  });
}

/**
 * JSON.parse replacement that restores BigInt, Map, and Set.
 */
export function jsonParse<T = unknown>(text: string): T {
  return JSON.parse(text, (_key, val) => {
    if (val !== null && typeof val === "object") {
      if (BIGINT_PREFIX in val) {
        return BigInt(val[BIGINT_PREFIX] as string);
      }
      if (MAP_MARKER in val) {
        return new Map(val[MAP_MARKER] as [unknown, unknown][]);
      }
      if (SET_MARKER in val) {
        return new Set(val[SET_MARKER] as unknown[]);
      }
    }
    return val;
  }) as T;
}
