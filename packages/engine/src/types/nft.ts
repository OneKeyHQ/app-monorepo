// safe import
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';

export const NFTChainMap: Record<string, string> = {
  [OnekeyNetwork.eth]: 'eth',
  [OnekeyNetwork.optimism]: 'optimism',
  [OnekeyNetwork.bsc]: 'bsc',
  [OnekeyNetwork.polygon]: 'polygon',
  [OnekeyNetwork.arbitrum]: 'arbitrum',
  [OnekeyNetwork.sol]: 'sol',
  [OnekeyNetwork.avalanche]: 'avalanche',
  [OnekeyNetwork.btc]: 'btc',
  [OnekeyNetwork.tbtc]: 'tbtc',
};

export type IErcNftType = 'erc721' | 'erc1155';

export type Traits = {
  traitType: string;
  value: string;
};

export type NFTServiceResp<T> = {
  success?: boolean;
  data?: T;
};

export type CollectionAttribute = {
  attributes_name: string;
  attributes_values: {
    attributes_value: string;
    total: number;
  }[];
};

export type Collection = {
  networkId?: string;
  accountAddress?: string;
  contractAddress?: string;
  contractName?: string;
  description?: string;
  logoUrl?: string;
  bannerUrl?: string;
  ownsTotal?: string;
  floorPrice?: number;
  priceSymbol?: string;
  assets: NFTAsset[];
  totalPrice: number;
  collectionId?: string;
  chain?: string;
  ercType?: string;
  attributes?: CollectionAttribute[];
  name?: string;
  itemsTotal?: number;
  ownersTotal?: number;
  amountsTotal?: number;
  volume24h?: number;
  openseaVerified?: boolean;
  royalty?: number;
  hasAttributes?: boolean;
  blueChip?: {
    next_blue_chip_probability: string | null;
  } | null;
};

export enum NFTAssetType {
  EVM = 'EVM',
  BTC = 'BTC',
  SOL = 'SOL',
}

export interface NFTAssetBase {
  type: NFTAssetType;
}

export type ValueOf<T> = T[keyof T];

interface NFTAssetInterface {
  EVM: NFTAsset;
  SOL: NFTAsset;
  BTC: NFTBTCAssetModel;
}

export type INFTAsset = ValueOf<NFTAssetInterface>;

export interface NFTAsset extends NFTAssetBase {
  networkId?: string;
  accountAddress?: string;
  tokenAddress?: string; // sol
  contractAddress?: string; // evm
  contractName?: string;
  contractTokenId?: string;
  tokenId?: string; // evm
  ercType?: IErcNftType;
  amount?: string;
  owner: string;
  tokenUri: string | null;
  contentType: string | null;
  imageUri: string | null;
  contentUri: string | null;
  nftscanUri: string | null;
  mintPrice?: number;
  mintTimestamp?: number;
  latestTradePrice?: number;
  latestTradeSymbol?: string;
  assetAttributes?: {
    attribute_name: string;
    attribute_value: string;
    percentage: string;
  }[];
  name?: string;
  description?: string;
  attributes?: Traits[];
  image: {
    source: string;
    thumbnail: string;
  };
  collection: {
    contractName?: string;
    logoUrl?: string;
    floorPrice?: number;
    openseaVerified?: boolean;
  };
}

export interface NFTBTCAssetModel extends NFTAssetBase {
  networkId?: string;
  accountAddress?: string;
  inscription_id: string;
  inscription_number: number;
  tx_hash: string;
  content: string | null;
  content_length: number;
  content_type: string;
  timestamp: string;
  output: string;
  owner: string;
  output_value_sat: number;
  genesis_transaction_hash: string;
  location: string;
  contentUrl: string;
  // block_number: number;
  // minter: string;
  // mint_value: number;
  // mint_value_sat: number;
  // mint_offset: number;
  // output_value: number;
  // own_timestamp: string;
}

export type NFTTransaction = {
  hash: string;
  from: string;
  to: string;
  gasPrice?: string;
  gasFee?: number;
  timestamp?: number;
  contractAddress?: string;
  contractName?: string;
  tokenId?: string;
  ercType?: string;
  send: string;
  receive: string;
  amount?: string;
  tradePrice?: string;
  tradeSymbol?: string;
  tradeSymbolAddress?: string | null;
  eventType?: string;
  exchangeName?: string;
  asset?: NFTAsset;
  verified?: boolean;
  collectionId?: string;
  // sol
  tokenAddress?: string;
  contractTokenId?: string;
};

export interface BTCTransactionsModel {
  tx_hash: string;
  block_hash: string;
  inscription_id: string;
  output: string;
  location: string;
  send: string;
  receive: string;
  event_type: string;
  timestamp: string;
  tx_index: number;
  block_number: number;
  fee: number;
  input_value: number;
  input_value_sat: number;
  output_value: number;
  output_value_sat: number;
  offset: number;

  asset?: NFTBTCAssetModel;
}

export type NFTMarketCapCollection = {
  contract_address?: string;
  contract_name?: string;
  logo_url?: string;
  banner_url?: string;

  items_total?: number;
  owners_total?: number;
  sales_1d?: number;
  sales_7d?: number;
  sales_30d?: number;
  sales_total?: number;
  volume_1d?: number;
  volume_7d?: number;
  volume_30d?: number;
  volume_total?: number;
  floor_price: number | null;
  average_price_1d?: number;
  average_price_7d?: number;
  average_price_30d?: number;
  average_price_total?: number;

  volume_change_1d?: string;
  volume_change_7d?: string;
  verified?: boolean;
  market_cap: number | null;
  openseaVerified?: boolean;
};

export type NFTMarketRanking = {
  contract_address?: string;
  contract_name?: string;
  logo_url?: string;
  lowest_price?: number;
  average_price?: number;
  highest_price?: number;
  floor_price?: number;
  volume?: number;
  sales?: number;
  mint_price_total?: number;
  mint_gas_fee?: number;
  exchange_volume_change_24h?: string;
  exchange_volume_change_7d?: string;
  items_total?: number;
  owners_total?: number;
  volume_change?: string;
  average_price_change?: string;
  market_cap?: number;
  market_trend?: string;
  mint_average_price?: number;
  volume_7d?: string;
  price_7d?: string;
  blueChip?: {
    next_blue_chip_probability: string | null;
  } | null;
  openseaVerified?: boolean;
};

export type NFTPNL = {
  contractAddress?: string;
  asset?: NFTAsset;
  contractName?: string;
  ercType?: string;
  tokenId: string;
  entry: {
    hash?: string;
    tradeSymbol?: string;
    eventType: string;
    timestamp: number;
    tradePrice?: number;
    exchangeName?: string;
    gasPrice?: string;
    gasFee?: number;
  };
  exit: {
    hash?: string;
    tradeSymbol?: string;
    eventType: string;
    timestamp: number;
    tradePrice?: number;
    exchangeName?: string;
    gasPrice?: string;
    gasFee?: number;
    internalTxValue?: number;
    tokenTxValue?: number;
  };

  profit: number;
  spend: number;
};

export type MarketPlace = {
  name: string;
  logoUrl?: string;
  networks: Record<string, { handlingFee?: string }>;
};

export type NFTListItems = Collection[] | NFTBTCAssetModel[];

export type NFTAssetMeta =
  | {
      data: Collection[];
      type: NFTAssetType.EVM;
    }
  | {
      data: Collection[];
      type: NFTAssetType.SOL;
    }
  | {
      data: NFTBTCAssetModel[];
      type: NFTAssetType.BTC;
    };

interface NFTAssetInterface {
  EVM: NFTAsset;
  SOL: NFTAsset;
  BTC: NFTBTCAssetModel;
}

export type BRC20TxHistory = {
  page: string;
  limit: string;
  totalPage: string;
  totalTransaction: string;
  inscriptionsList: {
    txId: string;
    blockHeight: string;
    state: string;
    tokenType: string;
    actionType: 'deploy' | 'mint' | 'inscribeTransfer' | 'transfer';
    fromAddress: string;
    toAddress: string;
    amount: string;
    token: string;
    inscriptionId: string;
    inscriptionNumber: string;
    index: string;
    location: string;
    msg: string;
    time: string;
  }[];
};
