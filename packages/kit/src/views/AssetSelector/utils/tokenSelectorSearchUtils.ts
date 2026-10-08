import type { IAccountToken } from '@onekeyhq/shared/types/token';

export type ITokenSelectorSearchTokenList<TContext extends string = string> = {
  tokens: IAccountToken[];
  searchKey: string;
  filterContext: TContext;
};

// Backend search results are only meaningful for the exact keywords + filter
// context they were fetched with. Keep them while the selector stays on that
// query and clear them the moment it moves on, so the local filter never
// merges rows that belong to another query.
export function resolveSearchTokenListForKeywords<TContext extends string>({
  prev,
  keywords,
  filterContext,
}: {
  prev: ITokenSelectorSearchTokenList<TContext>;
  keywords: string;
  filterContext: TContext;
}): ITokenSelectorSearchTokenList<TContext> {
  if (prev.searchKey === keywords && prev.filterContext === filterContext) {
    return prev;
  }
  return { tokens: [], searchKey: '', filterContext };
}

// A response may apply only when (1) no newer request superseded it and (2)
// the input still reads the keywords it was fetched for. (2) closes the window
// between the live key moving on and the next request firing: without it a
// slower response for an intermediate query ("usd" while editing "usdt" into
// "sol") lands after the user finished typing and shows the wrong list until
// the next debounce fires (OK-61484).
export function shouldApplySearchResponse({
  requestContext,
  latestRequestContext,
  keywords,
  liveSearchKey,
}: {
  requestContext: string;
  latestRequestContext: string;
  keywords: string;
  liveSearchKey: string;
}): boolean {
  return requestContext === latestRequestContext && keywords === liveSearchKey;
}
