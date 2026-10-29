// The routers' token selector (desktop demo, 10-29): what the deposit modal
// earns on, and the Loans window's two sides. A pick is one token, or a kind
// of token compared across its tokens

export type IEarnAssetType = 'stable' | 'eth' | 'btc' | 'sol' | 'other';

/** A kind of token the selectors group by, as the Loans filters name them */
export type IEarnAssetClass = Exclude<IEarnAssetType, 'other'>;

export type IEarnAssetPick =
  | { kind: 'class'; assetClass: IEarnAssetClass }
  | { kind: 'token'; symbol: string };

/**
 * What a list is for: what the deposit modal earns on, or a side of the
 * Loans window. It decides the figure on each row's right and the order
 */
export type IEarnAssetSelectPurpose = 'earn' | 'loanSupply' | 'loanBorrow';

export type IEarnAssetSelectNetwork = {
  id: string;
  name: string;
  logoURI: string;
};

export type IEarnAssetSelectToken = {
  symbol: string;
  name: string;
  logoURI: string;
  type: IEarnAssetType;
  // Where it is offered: one network shows as the logo's badge, several
  // under the name
  networks: IEarnAssetSelectNetwork[];
  // Its contract on each network, for a pasted address and the row's menu;
  // a network's own coin has none
  addresses: { networkId: string; address: string }[];
  // In %: the best rate Earn pays on it, or the lowest a loan of it costs
  rate?: number;
  // What the wallet holds of it where it is offered
  balance?: string;
  fiatValue?: number;
};
