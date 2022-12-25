import type { SignerPayloadRaw } from '@polkadot/types/types';
import type { UnsignedTransaction } from '@substrate/txwrapper-polkadot';

export interface DotImplOptions {
  addressPrefix: number;
  addressRegex: string;
}

// export type IEncodedTxDot = TxInfo & {
//   signingPayload?: string;
// };

export type IEncodedTxDot = UnsignedTransaction | SignerPayloadRaw;
