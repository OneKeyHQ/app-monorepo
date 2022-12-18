import type { Provider } from '../views/FiatPay/types';

const FiatInfo: Record<Provider, string[]> = {
  'moonpay': ['usd', 'cny', 'jpy', 'hkd'],
};

const symbolMap: Record<string, string> = {
  'usd': '$',
  'cny': '¥',
  'hkd': 'HK$',
  'jpy': 'JP¥',
};

export function getFiatCode(provider: Provider, currentCode: string) {
  if (FiatInfo[provider].includes(currentCode)) {
    return { fiatCode: currentCode, symbol: symbolMap[currentCode] };
  }
  return { fiatCode: 'usd', symbol: symbolMap.usd };
}
