export type ICurrencyType = 'crypto' | 'fiat' | 'popular';

export type ICurrencyItem = {
  id: string;
  unit: string;
  name: string;
  type: ICurrencyType[];
  value: string;
};
