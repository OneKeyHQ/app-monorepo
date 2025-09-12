import type { ICryptoData, IFeatureData, IUserData } from './types';

// Sample data
export const userData: IUserData[] = [
  {
    id: '1',
    name: 'Alice Johnson',
    email: 'alice@example.com',
    age: 28,
    status: 'active',
  },
  {
    id: '2',
    name: 'Bob Smith',
    email: 'bob@example.com',
    age: 34,
    status: 'inactive',
  },
  {
    id: '3',
    name: 'Charlie Brown',
    email: 'charlie@example.com',
    age: 22,
    status: 'active',
  },
];

export const cryptoData: ICryptoData[] = [
  {
    id: '1',
    symbol: 'BTC',
    name: 'Bitcoin',
    price: 45_000,
    change24h: 2.5,
  },
  {
    id: '2',
    symbol: 'ETH',
    name: 'Ethereum',
    price: 3200,
    change24h: -1.8,
  },
  {
    id: '3',
    symbol: 'SOL',
    name: 'Solana',
    price: 95,
    change24h: -2.1,
  },
];

export const featureData: IFeatureData[] = [
  { id: '1', feature: 'Custom Rendering', supported: 'Yes' },
  { id: '2', feature: 'Sorting', supported: 'Yes' },
  { id: '3', feature: 'Dragging', supported: 'Yes' },
  { id: '4', feature: 'Skeleton Loading', supported: 'Yes' },
  { id: '5', feature: 'Sticky Header', supported: 'Yes' },
];