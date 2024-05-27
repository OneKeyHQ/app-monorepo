import { parseAddress } from '@ckb-lumos/helpers';

import type { Options } from '@ckb-lumos/helpers';

export function isValidateAddress(
  address: string,
  { config = undefined }: Options = {},
): boolean {
  try {
    parseAddress(address, { config });
    return true;
  } catch {
    return false;
  }
}
