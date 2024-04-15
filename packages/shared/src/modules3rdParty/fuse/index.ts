import { useMemo } from 'react';

import Fuse from 'fuse.js';

import type {
  FuseIndex,
  FuseResult,
  FuseResultMatch,
  IFuseOptions,
} from 'fuse.js';

const defaultFuseOptions: IFuseOptions<any> = {
  location: 0,
  isCaseSensitive: false,
  includeMatches: true,
  shouldSort: true,
  findAllMatches: false,
  minMatchCharLength: 1,
  threshold: 0.8,
  distance: 1000,
  useExtendedSearch: true,
  ignoreLocation: false,
  ignoreFieldNorm: true,
  includeScore: true,
};

export type IFuseResult<T> = FuseResult<T>;
export type IFuseResultMatch = FuseResultMatch;

export function buildFuse<T>(
  list: ReadonlyArray<T>,
  options?: IFuseOptions<T>,
  index?: FuseIndex<T>,
) {
  const fuse = new Fuse(
    list,
    {
      ...defaultFuseOptions,
      ...options,
    },
    index,
  );
  fuse.search = function (pattern: string) {
    return Fuse.prototype.search.bind(fuse)(`'${pattern}`);
  };
  return fuse;
}

export function useFuse<T>(
  list?: ReadonlyArray<T>,
  options?: IFuseOptions<T>,
  index?: FuseIndex<T>,
) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => buildFuse(list || [], options, index), [list]);
}
