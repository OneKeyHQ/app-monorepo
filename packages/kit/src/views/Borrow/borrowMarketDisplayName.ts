import type { IBorrowMarketItem } from '@onekeyhq/shared/types/staking';

type IMarketNameParts = Pick<IBorrowMarketItem, 'name'>;

const GENERIC_NAME_WORDS = new Set(['market', 'markets', 'instance']);

const dropTrailingGenericWords = (words: string[]) => {
  let end = words.length;
  while (end > 1 && GENERIC_NAME_WORDS.has(words[end - 1].toLowerCase())) {
    end -= 1;
  }
  return words.slice(0, end);
};

export const getBorrowMarketLabel = (market: IMarketNameParts) => {
  const words = dropTrailingGenericWords(
    market.name.split(/\s+/).filter(Boolean),
  );
  return words.join(' ') || market.name;
};
