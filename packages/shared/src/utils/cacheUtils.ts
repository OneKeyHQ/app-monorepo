import stringify from 'fast-json-stable-stringify';
import cache from 'memoizee';

export type IMemoizeeOptions = cache.Options<any>;

export const memoizee: typeof cache = (f, options) => {
  // eslint-disable-next-line @typescript-eslint/unbound-method
  let { normalizer } = options ?? {};
  if (!normalizer) {
    normalizer = (...args) => {
      const result = stringify(args);
      return result;
    };
  }
  return cache(f, {
    ...options,
    normalizer,
  });
};

export function memoFn<T>(fn: () => T) {
  return memoizee(fn);
}
