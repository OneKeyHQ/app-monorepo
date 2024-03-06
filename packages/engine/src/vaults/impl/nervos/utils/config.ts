import { predefined } from '@ckb-lumos/config-manager';

export function getConfig(chainId: string) {
  if (chainId === 'mainnet') {
    return predefined.LINA;
  }
  return predefined.AGGRON4;
}
