import type { BigNumberish } from "starknet";
import { toBigInt } from "./crypto";

// ============ Utility Classes ============

/**
 * A flexible Map with optional key conversion and default value generation.
 *
 * @typeParam K - The key type used in the public API
 * @typeParam V - The value type
 * @typeParam InternalK - The internal key type used for storage (defaults to K)
 *
 * Features:
 * - Key conversion: Transform keys before storage (e.g., BigNumberish → bigint)
 * - Default factory: Auto-create values for missing keys
 *
 * Iteration methods (entries, keys, forEach) use InternalK for keys.
 */
export class AdvancedMap<K, V, InternalK = K> {
  private map = new Map<InternalK, V>();
  private options: {
    /** Convert external key K to internal key InternalK */
    keyConverter?: (key: K) => InternalK;
    /** Create default value when key is missing (makes get() always return V) */
    defaultFactory?: (key: K) => V;
  };

  // Overload 1: Just options
  constructor(options?: { keyConverter?: (key: K) => InternalK; defaultFactory?: (key: K) => V });

  // Overload 2: Entries + options
  constructor(
    entries: Iterable<readonly [K, V]> | null,
    options?: {
      keyConverter?: (key: K) => InternalK;
      defaultFactory?: (key: K) => V;
    }
  );

  constructor(
    entriesOrOptions?:
      | Iterable<readonly [K, V]>
      | null
      | {
          keyConverter?: (key: K) => InternalK;
          defaultFactory?: (key: K) => V;
        },
    options?: {
      keyConverter?: (key: K) => InternalK;
      defaultFactory?: (key: K) => V;
    }
  ) {
    let initialEntries: Iterable<readonly [K, V]> | null = null;

    if (entriesOrOptions === null || entriesOrOptions === undefined) {
      this.options = options || {};
    } else if (Symbol.iterator in Object(entriesOrOptions)) {
      initialEntries = entriesOrOptions as Iterable<readonly [K, V]>;
      this.options = options || {};
    } else {
      this.options =
        (entriesOrOptions as {
          keyConverter?: (key: K) => InternalK;
          defaultFactory?: (key: K) => V;
        }) || {};
    }

    if (initialEntries) {
      for (const [key, value] of initialEntries) {
        this.set(key, value);
      }
    }
  }

  private toInternalKey(key: K): InternalK {
    return this.options.keyConverter
      ? this.options.keyConverter(key)
      : (key as unknown as InternalK);
  }

  get(key: K, defaultValue?: (key: K) => V): V | undefined {
    const internalKey = this.toInternalKey(key);
    if (!this.map.has(internalKey) && (defaultValue || this.options.defaultFactory)) {
      this.map.set(
        internalKey,
        defaultValue ? defaultValue(key) : this.options.defaultFactory!(key)
      );
    }
    return this.map.get(internalKey);
  }

  set(key: K, value: V): this {
    this.map.set(this.toInternalKey(key), value);
    return this;
  }

  has(key: K): boolean {
    return this.map.has(this.toInternalKey(key));
  }

  delete(key: K): boolean {
    return this.map.delete(this.toInternalKey(key));
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }

  /** Iterate over entries with internal keys */
  entries(): IterableIterator<[InternalK, V]> {
    return this.map.entries();
  }

  /** Iterate over internal keys */
  keys(): IterableIterator<InternalK> {
    return this.map.keys();
  }

  /** Iterate over values */
  values(): IterableIterator<V> {
    return this.map.values();
  }

  /** ForEach with internal keys */
  forEach(callbackfn: (value: V, key: InternalK, map: Map<InternalK, V>) => void): void {
    this.map.forEach(callbackfn);
  }

  [Symbol.iterator](): IterableIterator<[InternalK, V]> {
    return this.map[Symbol.iterator]();
  }

  get [Symbol.toStringTag](): string {
    return "AdvancedMap";
  }
}

/**
 * A Map that accepts BigNumberish keys and normalizes them to bigint.
 * Optionally auto-creates default values for missing keys.
 *
 * @example
 * // Without defaults - get() returns V | undefined
 * const map = new AddressMap<number>();
 * map.get("0x1"); // number | undefined
 *
 * // With defaults - get() returns V (use non-null assertion or check)
 * const mapWithDefault = new AddressMap<number[]>(() => []);
 * mapWithDefault.get("0x1")!.push(42); // safe when defaultFactory provided
 */
export class BigNumberishMap<V> extends AdvancedMap<BigNumberish, V, bigint> {
  // Overload 1: Just a default factory (or nothing)
  constructor(defaultFactory?: (key: BigNumberish) => V);

  // Overload 2: Initial entries + optional default factory
  constructor(
    entries: Iterable<readonly [BigNumberish, V]> | null,
    defaultFactory?: (key: BigNumberish) => V
  );

  constructor(
    entriesOrDefaultFactory?:
      | ((key: BigNumberish) => V)
      | Iterable<readonly [BigNumberish, V]>
      | null,
    defaultFactory?: (key: BigNumberish) => V
  ) {
    let initialEntries: Iterable<readonly [BigNumberish, V]> | null = null;
    let factory: ((key: BigNumberish) => V) | undefined;

    if (typeof entriesOrDefaultFactory === "function") {
      factory = entriesOrDefaultFactory;
    } else if (
      Symbol.iterator in Object(entriesOrDefaultFactory) ||
      entriesOrDefaultFactory === null
    ) {
      initialEntries = entriesOrDefaultFactory ?? null;
      factory = defaultFactory;
    }

    super(initialEntries, {
      keyConverter: (key: BigNumberish): bigint => toBigInt(key),
      defaultFactory: factory,
    });
  }
}

export const AddressMap = BigNumberishMap;
export type AddressMap<V> = BigNumberishMap<V>;
