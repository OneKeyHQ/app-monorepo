// The routers' token selector (desktop demo, 10-29): what the deposit modal
// earns on, and the Loans window's two sides. A pick is one token, or a kind
// of token compared across its tokens. Since 11-05 it also carries where:
// one network, or every network (Earn bridges what the wallet holds elsewhere)

export type IEarnAssetType = 'stable' | 'eth' | 'btc' | 'sol' | 'other';

/** A kind of token the selectors group by, as the Loans filters name them */
export type IEarnAssetClass = Exclude<IEarnAssetType, 'other'>;

export type IEarnAssetPick =
  | {
      kind: 'class';
      assetClass: IEarnAssetClass;
      // One network; unset, every network ("All Networks")
      networkId?: string;
    }
  | {
      kind: 'token';
      symbol: string;
      // One network; unset, every network ("All Networks")
      networkId?: string;
    };

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

/** A token on one network it is offered on, with its figures there */
export type IEarnAssetSelectTokenNetwork = IEarnAssetSelectNetwork & {
  // In %: the best rate Earn pays on it here, or the lowest a loan costs
  rate?: number;
  // What the wallet holds of it here
  balance?: string;
  fiatValue?: number;
};

export type IEarnAssetSelectToken = {
  symbol: string;
  name: string;
  logoURI: string;
  type: IEarnAssetType;
  // Every network it is offered on, each with its own figures
  networks: IEarnAssetSelectTokenNetwork[];
  // Its contract on each network, for a pasted address and the row's menu;
  // a network's own coin has none
  addresses: { networkId: string; address: string }[];
  // Across its networks, in %: the best rate Earn pays on it, or the lowest
  // a loan of it costs
  rate?: number;
  // What the wallet holds of it across its networks
  balance?: string;
  fiatValue?: number;
};
