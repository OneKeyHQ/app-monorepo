import { isString } from 'lodash';

import { isLightningAddress } from '@onekeyhq/engine/src/vaults/impl/lightning-network/helper/lnurl';

export const shortenAddress = (address: string, chars = 4) => {
  if (!address || !isString(address)) {
    return address;
  }
  if (address.includes('@') && isLightningAddress(address)) {
    return address;
  }
  const prevOffset = address.startsWith('0x') ? chars + 2 : chars;
  return `${address.slice(0, prevOffset)}...${address.slice(-chars)}`;
};

export const CDN_PREFIX = 'https://onekey-asset.com/';

export const numberToString = (value: number): string => {
  const eFormat = value.toExponential();
  const tmpArray = eFormat.match(/\d(?:\.(\d*))?e([+-]\d+)/);
  const number = value.toFixed(
    Math.max(0, (tmpArray?.[1] || '').length - parseInt(tmpArray?.[2] ?? '0')),
  );
  return number;
};
