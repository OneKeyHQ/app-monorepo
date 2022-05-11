import { toLower } from 'lodash';

import { IMPL_EVM } from './constants';

export function fixAddressCase({
  impl,
  address,
}: {
  impl: string;
  address: string;
}) {
  if (IMPL_EVM === impl) {
    return toLower(address);
  }
  return address;
}
