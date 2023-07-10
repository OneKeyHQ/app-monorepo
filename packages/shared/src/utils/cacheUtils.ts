import stringify from 'fast-json-stable-stringify';
import cache from 'memoizee';

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
