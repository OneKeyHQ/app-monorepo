export const AssetSelectorTestIDs = {
  // --- Token Selector ---
  tokenSelectorList: 'asset-selector-token-list',
  tokenSelectorItemTestIDPrefix: 'asset-selector-token-item',
  tokenSelectorListItem: (networkId: string, symbol: string) =>
    `asset-selector-token-item-${networkId}-${symbol}`,

  // --- Aggregate Token Selector ---
  aggregateTokenList: 'asset-selector-aggregate-token-list',
  aggregateTokenListItem: 'asset-selector-aggregate-token-list-item',
} as const;
