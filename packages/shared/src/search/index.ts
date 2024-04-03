import Fuse from 'fuse.js';

import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';

import timerUtils from '../utils/timerUtils';

import type { FuseIndex, IFuseOptions } from 'fuse.js';

const defaultFuseOptions: IFuseOptions<any> = {
  location: 0,
  isCaseSensitive: false,
  includeMatches: false,
  shouldSort: true,
  findAllMatches: true,
  minMatchCharLength: 2,
  threshold: 0.5,
  distance: 100,
  useExtendedSearch: false,
  ignoreLocation: false,
  ignoreFieldNorm: true,
  includeScore: true,
};

function _buildFuse<T>(
  list: ReadonlyArray<T>,
  options?: IFuseOptions<T>,
  index?: FuseIndex<T>,
) {
  return new Fuse(
    list,
    {
      ...defaultFuseOptions,
      ...options,
    },
    index,
  );
}

export const buildFuse = memoizee(_buildFuse, {
  max: 50,
  maxAge: timerUtils.getTimeDurationMs({ minute: 5 }),
});
