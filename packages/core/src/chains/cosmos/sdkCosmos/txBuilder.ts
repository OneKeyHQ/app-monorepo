/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { hexToBytes } from '@noble/hashes/utils';
import { MsgSend } from 'cosmjs-types/cosmos/bank/v1beta1/tx';
import { PubKey } from 'cosmjs-types/cosmos/crypto/ed25519/keys';
import { MsgWithdrawDelegatorReward } from 'cosmjs-types/cosmos/distribution/v1beta1/tx';
import { MsgVote } from 'cosmjs-types/cosmos/gov/v1beta1/tx';
import {
  MsgBeginRedelegate,
  MsgDelegate,
  MsgUndelegate,
} from 'cosmjs-types/cosmos/staking/v1beta1/tx';
import { SignMode } from 'cosmjs-types/cosmos/tx/signing/v1beta1/signing';
import {
  AuthInfo,
  Fee,
  SignerInfo,
  TxBody,
  TxRaw,
} from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import { MsgExecuteContract } from 'cosmjs-types/cosmwasm/wasm/v1/tx';
import { Any } from 'cosmjs-types/google/protobuf/any';
import { MsgTransfer } from 'cosmjs-types/ibc/applications/transfer/v1/tx';
import Long from 'long';

import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';

import {
  getAminoSignDoc,
  getDirectSignDoc,
  sortedJsonByKeyStringify,
} from './wrapper/utils';

import type { ICosmosStdMsg } from './amino/types';
import type { ICosmosProtoMsgsOrWithAminoMsgs } from './ITxMsgBuilder';
import type { TransactionWrapper } from './wrapper';

export interface ICosmosTxBuilder {
  makeTxWrapper(
    messages: ICosmosProtoMsgsOrWithAminoMsgs,
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
  ): TransactionWrapper;
}

export const generateSignBytes = (
  encodedTx: TransactionWrapper,
): Uint8Array => {
  if (encodedTx.mode === 'amino') {
    const signDoc = getAminoSignDoc(encodedTx);
    return Buffer.from(sortedJsonByKeyStringify(signDoc));
  }

  const directSignDoc = getDirectSignDoc(encodedTx);
  return directSignDoc.toBytes();
};

/**
 * Sign the transaction with the provided signature.
 * @param encodedTx - TransactionWrapper
 * @returns Uint8Array
 */
export const serializeTxForSignature = (encodedTx: TransactionWrapper) => {
  if (encodedTx.mode === 'amino') {
    const signDoc = getAminoSignDoc(encodedTx);
    return Buffer.from(sortedJsonByKeyStringify(signDoc));
  }

  const directSignDoc = getDirectSignDoc(encodedTx);
  return directSignDoc.toBytes();
};

export const deserializeTx = (txBytes: Uint8Array) => {
  const txRaw = TxRaw.decode(txBytes);
  const txBody = TxBody.decode(txRaw.bodyBytes);
  const authInfo = AuthInfo.decode(txRaw.authInfoBytes);

  return {
    txBody,
    authInfo,
    signatures: txRaw.signatures,
  };
};

function getConverter(msgType: string) {
  const converter = {
    'cosmos-sdk/MsgSend': (msg: ICosmosStdMsg) => ({
      typeUrl: '/cosmos.bank.v1beta1.MsgSend',
      value: Buffer.from(
        MsgSend.encode(
          MsgSend.fromPartial({
            fromAddress: msg.value.from_address,
            toAddress: msg.value.to_address,
            amount: msg.value.amount,
          }),
        ).finish(),
      ).toString('hex'),
    }),
    'cosmos-sdk/MsgTransfer': (msg: ICosmosStdMsg) => ({
      typeUrl: '/ibc.applications.transfer.v1.MsgTransfer',
      value: Buffer.from(
        MsgTransfer.encode(
          MsgTransfer.fromPartial({
            sourcePort: msg.value.source_port,
            sourceChannel: msg.value.source_channel,
            token: msg.value.token,
            sender: msg.value.sender,
            receiver: msg.value.receiver,
            timeoutHeight: msg.value.timeout_height
              ? {
                  revisionHeight: msg.value.timeout_height.revision_height,
                  revisionNumber: msg.value.timeout_height.revision_number,
                }
              : undefined,
            timeoutTimestamp: msg.value.timeout_timestamp,
            memo: msg.value.memo,
          }),
        ).finish(),
      ).toString('hex'),
    }),
    'cosmos-sdk/MsgDelegate': (msg: ICosmosStdMsg) => ({
      typeUrl: '/cosmos.staking.v1beta1.MsgDelegate',
      value: Buffer.from(
        MsgDelegate.encode(
          MsgDelegate.fromPartial({
            delegatorAddress: msg.value.delegator_address,
            validatorAddress: msg.value.validator_address,
            amount: msg.value.amount,
          }),
        ).finish(),
      ).toString('hex'),
    }),
    'cosmos-sdk/MsgUndelegate': (msg: ICosmosStdMsg) => ({
      typeUrl: '/cosmos.staking.v1beta1.MsgUndelegate',
      value: Buffer.from(
        MsgUndelegate.encode(
          MsgUndelegate.fromPartial({
            delegatorAddress: msg.value.delegator_address,
            validatorAddress: msg.value.validator_address,
            amount: msg.value.amount,
          }),
        ).finish(),
      ).toString('hex'),
    }),
    'cosmos-sdk/MsgWithdrawDelegationReward': (msg: ICosmosStdMsg) => ({
      typeUrl: '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward',
      value: Buffer.from(
        MsgWithdrawDelegatorReward.encode(
          MsgWithdrawDelegatorReward.fromPartial({
            delegatorAddress: msg.value.delegator_address,
            validatorAddress: msg.value.validator_address,
          }),
        ).finish(),
      ).toString('hex'),
    }),
    'cosmos-sdk/MsgBeginRedelegate': (msg: ICosmosStdMsg) => ({
      typeUrl: '/cosmos.staking.v1beta1.MsgBeginRedelegate',
      value: Buffer.from(
        MsgBeginRedelegate.encode(
          MsgBeginRedelegate.fromPartial({
            delegatorAddress: msg.value.delegator_address,
            validatorSrcAddress: msg.value.validator_src_address,
            validatorDstAddress: msg.value.validator_dst_address,
            amount: msg.value.amount,
          }),
        ).finish(),
      ).toString('hex'),
    }),
    'cosmos-sdk/MsgVote': (msg: ICosmosStdMsg) => ({
      typeUrl: '/cosmos.gov.v1beta1.MsgVote',
      value: Buffer.from(
        MsgVote.encode(
          MsgVote.fromPartial({
            proposalId: msg.value.proposal_id,
            voter: msg.value.voter,
            option: msg.value.option,
          }),
        ).finish(),
      ).toString('hex'),
    }),
    'wasm/MsgExecuteContract': (msg: ICosmosStdMsg) => ({
      typeUrl: '/cosmwasm.wasm.v1.MsgExecuteContract',
      value: Buffer.from(
        MsgExecuteContract.encode(
          MsgExecuteContract.fromPartial({
            sender: msg.value.sender,
            contract: msg.value.contract,
            msg: msg.value.msg,
            funds: msg.value.funds,
          }),
        ).finish(),
      ).toString('hex'),
    }),
  };
  return converter[msgType as keyof typeof converter];
}

function convertAminoMsgToDirect(msg: ICosmosStdMsg) {
  const converter = getConverter(msg.type);
  if (converter) {
    return converter(msg);
  }

  return {
    typeUrl: msg.type,
    value: typeof msg.value === 'string' ? msg.value : '',
  };
}

/**
 *
 * @param signDoc - TransactionWrapper
 * @param signature - Uint8Array[]
 * @param publicKey - hex string
 * @returns Uint8Array
 */
export const serializeSignedTx = ({
  txWrapper: signDoc,
  signature: { signatures, signMode = SignMode.SIGN_MODE_LEGACY_AMINO_JSON },
  publicKey: { pubKey, pubKeyType = '/cosmos.crypto.secp256k1.PubKey' },
}: {
  txWrapper: TransactionWrapper;
  signature: {
    signatures: Uint8Array[];
    signMode?: SignMode;
  };
  publicKey: {
    pubKey: string;
    pubKeyType?: string;
  };
}): Uint8Array => {
  if (signDoc.mode === 'amino') {
    const content = getAminoSignDoc(signDoc);
    let msgs = signDoc.msg?.protoMsgs;
    if (!msgs) {
      msgs = content.msgs
        .map((msg) => convertAminoMsgToDirect(msg))
        .filter((msg) => msg.value);
    }

    const pubKeyAny = Any.fromPartial({
      typeUrl: pubKeyType,
      value: Uint8Array.from(
        PubKey.encode(
          PubKey.fromPartial({
            key: hexToBytes(hexUtils.stripHexPrefix(pubKey)),
          }),
        ).finish(),
      ),
    });

    return TxRaw.encode({
      bodyBytes: TxBody.encode(
        TxBody.fromPartial({
          messages: msgs?.map((msg) => ({
            typeUrl: msg.typeUrl,
            value: hexToBytes(msg.value),
          })),
          memo: content.memo,
        }),
      ).finish(),
      authInfoBytes: AuthInfo.encode({
        signerInfos: [
          SignerInfo.fromPartial({
            publicKey: pubKeyAny,
            modeInfo: {
              single: {
                mode: signMode,
              },
            },
            sequence: Long.fromString(content.sequence),
          }),
        ],
        fee: Fee.fromPartial({
          amount: content.fee.amount.map((amount) => ({
            amount: amount.amount,
            denom: amount.denom,
          })),
          gasLimit: Long.fromString(content.fee.gas),
        }),
      }).finish(),
      signatures,
    }).finish();
  }

  const { bodyBytes, authInfoBytes } = getDirectSignDoc(signDoc).signDoc;

  return TxRaw.encode(
    TxRaw.fromPartial({
      bodyBytes: hexToBytes(bodyBytes),
      authInfoBytes: hexToBytes(authInfoBytes),
      signatures,
    }),
  ).finish();
};
