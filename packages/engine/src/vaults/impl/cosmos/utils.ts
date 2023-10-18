import { IDecodedTxActionType } from '../../types';

import { defaultAminoMsgOpts } from './sdk/amino/types';
import { MessageType } from './sdk/message';

import type { StdSignDoc } from './sdk/amino/types';
import type { Message, SendMessage } from './sdk/message';
import type { UnpackedMessage } from './sdk/proto/protoDecode';
import type { Coin } from 'cosmjs-types/cosmos/base/v1beta1/coin';

export const getTransactionTypeByMessage = (
  message: Message,
  mainCoinDenom?: string,
) => {
  if (message['@type'] === MessageType.SEND) {
    const { amount } = message as SendMessage;
    if (amount.length === 1 && amount[0].denom === mainCoinDenom) {
      return IDecodedTxActionType.NATIVE_TRANSFER;
    }
    return IDecodedTxActionType.TOKEN_TRANSFER;
  }
  return IDecodedTxActionType.UNKNOWN;
};

export const getTransactionTypeByProtoMessage = (
  message: UnpackedMessage,
  mainCoinDenom?: string,
) => {
  if ('unpacked' in message) {
    if (
      message.typeUrl === MessageType.SEND ||
      message.typeUrl === defaultAminoMsgOpts.send.native.type
    ) {
      const { amount }: { amount: Coin[] } = message.unpacked;
      if (amount.length === 1 && amount[0].denom === mainCoinDenom) {
        return IDecodedTxActionType.NATIVE_TRANSFER;
      }
      return IDecodedTxActionType.TOKEN_TRANSFER;
    }
  }

  return IDecodedTxActionType.UNKNOWN;
};

export const getDataForADR36 = (
  data: string | Uint8Array,
): [string, boolean] => {
  let isADR36WithString = false;
  let newData = data;
  if (typeof data === 'string') {
    newData = Buffer.from(data).toString('base64');
    isADR36WithString = true;
  } else {
    newData = Buffer.from(data).toString('base64');
  }
  return [newData, isADR36WithString];
};

export const getADR36SignDoc = (signer: string, data: string): StdSignDoc => ({
  chain_id: '',
  account_number: '0',
  sequence: '0',
  fee: {
    gas: '0',
    amount: [],
  },
  msgs: [
    {
      type: 'sign/MsgSignData',
      value: {
        signer,
        data,
      },
    },
  ],
  memo: '',
});
