import type { IFeeInfoUnit } from '@onekeyhq/shared/types/fee';

import type { UnsignedTransaction } from '@substrate/txwrapper-polkadot';

export const DOT_TYPE_PREFIX = {
  ecdsa: new Uint8Array([2]),
  ed25519: new Uint8Array([0]),
  ethereum: new Uint8Array([2]),
  sr25519: new Uint8Array([1]),
};

export type IEncodedTxDot = UnsignedTransaction & {
  specName?: string;
  feeInfo?: IFeeInfoUnit;
  chainName?: string;
};
