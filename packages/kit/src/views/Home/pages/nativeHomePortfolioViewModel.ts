import type {
  INativeHomePortfolioItemViewModel,
  INativeHomePortfolioViewModel,
} from '@onekeyhq/native-components';

export function buildNativeHomePortfolioViewModel({
  ownerMatches,
  generation,
  sourceItemCount,
  items,
  title,
  emptyText,
}: {
  ownerMatches: boolean;
  generation: number;
  sourceItemCount: number;
  items: INativeHomePortfolioItemViewModel[];
  title: string;
  emptyText: string;
}): INativeHomePortfolioViewModel {
  const structureReady = ownerMatches && generation >= 0;
  const metadataReady = sourceItemCount === 0 || items.length > 0;
  const visibleItems = structureReady ? items : [];

  let state: INativeHomePortfolioViewModel['state'] = 'initialLoading';
  if (structureReady && metadataReady) {
    state = visibleItems.length > 0 ? 'ready' : 'empty';
  }

  return {
    title,
    state,
    emptyText,
    items: visibleItems,
  };
}
