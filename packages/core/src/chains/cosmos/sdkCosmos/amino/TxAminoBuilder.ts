import { TransactionWrapper } from '../wrapper';

import type { ProtoMsgsOrWithAminoMsgs } from '../ITxMsgBuilder';
import type { TxBuilder } from '../txBuilder';

export class TxAminoBuilder implements TxBuilder {
  makeTxWrapper(
    messages: ProtoMsgsOrWithAminoMsgs,
    params: {
      memo: string;
      gasLimit: string;
      feeAmount: string;
      pubkey: Uint8Array;
      mainCoinDenom: string;
      chainId: string;
      accountNumber: string;
      nonce: string;
    },
  ): TransactionWrapper {
    return TransactionWrapper.fromAminoSignDoc(
      {
        chain_id: params.chainId,
        account_number: params.accountNumber,
        sequence: params.nonce,
        fee: {
          amount: [
            {
              amount: params.feeAmount,
              denom: params.mainCoinDenom,
            },
          ],
          gas: params.gasLimit,
        },
        msgs: messages.aminoMsgs,
        memo: params.memo,
      },
      messages,
    );
  }
}
