import { SUI_TYPE_ARG, normalizeSuiAddress } from '@mysten/sui.js/utils';

export function normalizeSuiCoinType(coinType: string): string {
  if (coinType !== SUI_TYPE_ARG) {
    const [normalAddress, module, name] = coinType.split('::');
    if (module && name) {
      try {
        return `${normalizeSuiAddress(
          normalAddress,
        ).toLowerCase()}::${module}::${name}`;
      } catch {
        // pass
      }
    }
  }
  return coinType;
}
