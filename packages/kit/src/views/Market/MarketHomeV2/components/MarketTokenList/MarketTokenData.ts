export interface IMarketToken {
  id: string;
  name: string;
  symbol: string;
  price: number;
  change24h: number;
}

export const defaultData: IMarketToken[] = [
  { id: '1', name: 'Bitcoin', symbol: 'BTC', price: 45_000, change24h: 2.5 },
  { id: '2', name: 'Ethereum', symbol: 'ETH', price: 3000, change24h: -1.2 },
  // Add more sample data as needed
];
