import {
  addHexPrefix,
  isHexString,
  stripHexPrefix,
} from '@onekeyhq/engine/src/vaults/utils/hexUtils';

import { SubstrateAddress } from '../substrate/SubstrateAddress';

import type { SubstrateAccountId } from './types';

// see https://wiki.polkadot.network/docs/build-protocol-info
export const accountIdToAddress = (
  accountId: SubstrateAccountId<SubstrateAddress>,
  ss58Format = 42,
): SubstrateAddress => {
  if (typeof accountId === 'string' && isHexString(addHexPrefix(accountId))) {
    return SubstrateAddress.fromPublicKey(
      stripHexPrefix(accountId),
      ss58Format,
    );
  }
  if (typeof accountId === 'string') {
    return SubstrateAddress.fromEncoded(accountId);
  }
  return accountId;
};
