// Sample data types
export interface IUserData {
  id: string;
  name: string;
  email: string;
  age: number;
  status: 'active' | 'inactive';
}

export interface ICryptoData {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
}

export interface IFeatureData {
  id: string;
  feature: string;
  supported: string;
}