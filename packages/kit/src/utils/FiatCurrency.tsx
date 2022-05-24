import { Provider } from '../views/FiatPay/types';

const FiatInfo: Record<Provider, string[]> = {
  'moonpay': ['usd', 'cny', 'jpy', 'hkd'],
};

export function getFiatCode(provider: Provider, currentCode: string) {
  if (FiatInfo[provider].includes(currentCode)) {
    return currentCode;
  }
  return 'usd';
}
