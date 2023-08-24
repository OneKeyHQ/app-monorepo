import type { SimpleDbEntityBase } from '@onekeyhq/engine/src/dbs/simple/entity/SimpleDbEntityBase';
import type { IAppState } from '@onekeyhq/kit/src/store';

type Prev = [
  never,
  0,
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  12,
  13,
  14,
  15,
  16,
  17,
  18,
  19,
  20,
  ...0[],
];

type Join<K, P> = K extends string | number
  ? P extends string | number
    ? `${K}${'' extends P ? '' : '.'}${P}`
    : never
  : never;

/**
 * Get all possible paths for an object
 *
 * @see https://stackoverflow.com/a/58436959
 */
type ObjectPath<T, D extends number = 10> = [D] extends [never]
  ? never
  : T extends object
  ? {
      [K in keyof T]-?: K extends string | number
        ? `${K}` | Join<K, ObjectPath<T[K], Prev[D]>>
        : never;
    }[keyof T]
  : '';

export type ReduxStatePath = ObjectPath<IAppState>;

export type SimpleDbDataPath<TSimpleDbEntity> =
  TSimpleDbEntity extends SimpleDbEntityBase<infer S> ? ObjectPath<S> : never;

/**
 * Reset the value to `resetToValue` if the expiry is reached
 */
interface ExpiryStrategy {
  type: 'reset-on-expiry';
  /**
   * In seconds
   */
  expiry: number;
  resetToValue: any;
}

/**
 * Keep the array length <= `maxToKeep`
 */
interface ArraySliceStrategy {
  type: 'array-slice';
  maxToKeep: number;
  keepItemsAt: 'head' | 'tail';
}

interface CustomStrategy {
  type: 'custom';
  /**
   * @param dataAtPath The data at the path
   * @returns New data to be set at the path
   */
  run: (dataAtPath: any) => Promise<any>;
}

export interface BaseCleanupPolicy {
  strategy: ExpiryStrategy | ArraySliceStrategy | CustomStrategy;
}

export interface ReduxCleanupPolicy extends BaseCleanupPolicy {
  source: 'redux';
  dataPaths: ReduxStatePath[];
}

export interface SimpleDbCleanupPolicy<
  TSimpleDbEntity extends SimpleDbEntityBase<unknown>,
> extends BaseCleanupPolicy {
  source: 'simpleDb';
  simpleDbEntity: TSimpleDbEntity;
  dataPaths: SimpleDbDataPath<TSimpleDbEntity>[];
}

export type CleanupPolicy =
  | ReduxCleanupPolicy
  | SimpleDbCleanupPolicy<SimpleDbEntityBase<unknown>>;
