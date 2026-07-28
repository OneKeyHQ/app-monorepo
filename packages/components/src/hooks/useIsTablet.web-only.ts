import cache from 'memoizee';

export const isNativeTablet = cache(() => false);
