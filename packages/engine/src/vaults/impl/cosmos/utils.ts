import { hexToBytes } from '@noble/hashes/utils';

import { IDecodedTxActionType } from '../../types';

import { MessageType } from './sdk/message';
import { makeTxRawBytes } from './sdk/signing';
import { getDirectSignDoc } from './sdk/wrapper/utils';

import type { Message, SendMessage } from './sdk/message';
import type { UnpackedMessage } from './sdk/proto/protoDecode';
import type { IEncodedTxCosmos } from './type';
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
    if (message.typeUrl === MessageType.SEND) {
      const { amount }: { amount: Coin[] } = message.unpacked;
      if (amount.length === 1 && amount[0].denom === mainCoinDenom) {
        return IDecodedTxActionType.NATIVE_TRANSFER;
      }
      return IDecodedTxActionType.TOKEN_TRANSFER;
    }
  }

  return IDecodedTxActionType.UNKNOWN;
};

export const generateSignBytes = (encodedTx: IEncodedTxCosmos) => {
  const directSignDoc = getDirectSignDoc(encodedTx);
  return directSignDoc.toBytes();
};

export const generateSignedTx = (
  encodedTx: IEncodedTxCosmos,
  signature: Buffer,
) =>
  makeTxRawBytes(
    hexToBytes(encodedTx.bodyBytes),
    hexToBytes(encodedTx.authInfoBytes),
    [signature],
  );
