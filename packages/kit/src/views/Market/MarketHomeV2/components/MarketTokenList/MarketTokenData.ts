export interface IMarketToken {
  id: string;
  name: string;
  symbol: string;
  price: number;
  change24h: number;
  marketCap: number;
  liquidity: number;
  transactions: number;
  uniqueTraders: number;
  holders: number;
  turnover: number;
  tokenAge: string;
  audit: string;
  walletInfo?: string;
}

export const defaultData: IMarketToken[] = [
  {
    id: '1',
    name: 'TRUMP',
    symbol: 'TRUMP',
    price: 108_484.44,
    change24h: 1.28,
    marketCap: 2.06e9,
    liquidity: 4.0526e8,
    transactions: 53_030,
    uniqueTraders: 2810,
    holders: 639_590,
    turnover: 6.328e7,
    tokenAge: '2M',
    audit: '6p6xgH...GiPN',
    walletInfo: '38.55K/39.64K',
  },
  {
    id: '2',
    name: 'Ethereum',
    symbol: 'ETH',
    price: 0.054_421,
    change24h: -0.57,
    marketCap: 2.06e9,
    liquidity: 4.0526e8,
    transactions: 53_030,
    uniqueTraders: 2810,
    holders: 639_590,
    turnover: 6.328e7,
    tokenAge: '5D',
    audit: '6p6xgH...GiPN',
    walletInfo: '38.55K/39.64K',
  },
  {
    id: '3',
    name: 'Solana',
    symbol: 'SOL',
    price: 400.1461,
    change24h: -3.01,
    marketCap: 2.06e9,
    liquidity: 4.0526e8,
    transactions: 53_030,
    uniqueTraders: 2810,
    holders: 639_590,
    turnover: 2.705e7,
    tokenAge: '1Y',
    audit: '0xd31a...b89c',
    walletInfo: '38.55K/39.64K',
  },
];
