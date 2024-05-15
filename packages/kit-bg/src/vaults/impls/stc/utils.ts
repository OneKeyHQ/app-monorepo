import { arrayify } from '@ethersproject/bytes';
import {
  crypto_hash as CryptoHash,
  starcoin_types as StarcoinTypes,
  bcs,
  encoding,
  utils,
} from '@starcoin/starcoin';
import BigNumber from 'bignumber.js';

import type { IEncodedTxStc } from '@onekeyhq/core/src/chains/stc/types';
import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';
import type { IToken } from '@onekeyhq/shared/types/token';

export function encodeTokenTransferData({
  to,
  token,
  amount,
}: {
  to: string;
  token: IToken;
  amount: string;
}): string {
  return encoding.bcsEncode(
    utils.tx.encodeScriptFunction(
      '0x00000000000000000000000000000001::TransferScripts::peer_to_peer_v2',
      utils.tx.encodeStructTypeTags([token.address]),
      utils.tx.encodeScriptFunctionArgs(
        [{ type_tag: 'Address' }, { type_tag: 'U128' }],
        [
          to,
          `0x${new BigNumber(amount).shiftedBy(token.decimals).toString(16)}`,
        ],
      ),
    ),
  );
}

export function decodeDataAsTransfer(data: string) {
  const ret = { to: '', tokenAddress: '', amountValue: '' };
  try {
    let amountString;

    const decodedPayload = encoding.decodeTransactionPayload(data);
    const {
      ScriptFunction: {
        func: {
          address: functionAddress,
          module: functionModule,
          functionName,
        },
        args: functionArgs,
      },
    } = decodedPayload as IDecodedSTCPayload;

    if (
      functionAddress === '0x00000000000000000000000000000001' ||
      functionModule === 'TransferScripts'
    ) {
      if (functionName === 'peer_to_peer_v2') {
        [, amountString] = functionArgs;
      } else if (functionName === 'peer_to_peer') {
        [, , amountString] = functionArgs;
      }
    }

    if (amountString) {
      ret.amountValue = new BigNumber(
        new bcs.BcsDeserializer(arrayify(amountString))
          .deserializeU128()
          .toString(),
      ).toFixed();
      const {
        ScriptFunction: {
          ty_args: [
            {
              Struct: { name, module, address },
            },
          ],
        },
      } = decodedPayload as IDecodedSTCPayload;
      ret.tokenAddress = `${address}::${module}::${name}`;
      [ret.to] = functionArgs;
    }
  } catch (e) {
    console.log(e);
  }

  return ret;
}

export function decodeTransactionPayload(data: string): IDecodedPayload {
  const tokenTransfer = decodeDataAsTransfer(data);
  if (tokenTransfer.tokenAddress) {
    return { type: 'tokenTransfer', payload: tokenTransfer };
  }

  let name = '';
  let params;
  try {
    const txnPayload = encoding.decodeTransactionPayload(data) as Record<
      string,
      any
    >;
    [name] = Object.keys(txnPayload);
    params = txnPayload[name];
  } catch (error) {
    console.log('Failed to decode transaction data.', error, data);
  }
  return { type: 'other', payload: { name, params } };
}

export function buildUnsignedRawTx(
  unsignedTx: IUnsignedTxPro,
  chainId: string,
): [StarcoinTypes.RawUserTransaction, Uint8Array] {
  const encodedTx = unsignedTx.encodedTx as IEncodedTxStc;
  const fromAddr = encodedTx.from;
  const { txPayload, expirationTime } = unsignedTx.payload || {};

  const gasLimit = encodedTx.gasLimit;
  const gasPrice = encodedTx.gasPrice;
  const nonce = encodedTx.nonce;

  if (
    !fromAddr ||
    !txPayload ||
    !gasLimit ||
    !gasPrice ||
    typeof nonce === 'undefined'
  ) {
    throw new Error('invalid unsignedTx');
  }

  const rawTxn = utils.tx.generateRawUserTransaction(
    fromAddr,
    txPayload,
    new BigNumber(gasLimit).toNumber(),
    new BigNumber(gasPrice).toNumber(),
    nonce,
    expirationTime,
    Number(chainId),
  );

  const serializer = new bcs.BcsSerializer();
  rawTxn.serialize(serializer);

  return [rawTxn, serializer.getBytes()];
}

export function hashRawTx(rawUserTransactionBytes: Uint8Array): Uint8Array {
  const hashSeedBytes = CryptoHash.createRawUserTransactionHasher().get_salt();
  return Uint8Array.of(...hashSeedBytes, ...rawUserTransactionBytes);
}

export function buildSignedTx(
  senderPublicKey: string,
  rawSignature: Buffer,
  rawTxn: StarcoinTypes.RawUserTransaction,
  encodedTx: any,
) {
  const publicKey = new StarcoinTypes.Ed25519PublicKey(
    Buffer.from(senderPublicKey, 'hex'),
  );
  const signature = new StarcoinTypes.Ed25519Signature(rawSignature);
  const transactionAuthenticatorVariantEd25519 =
    new StarcoinTypes.TransactionAuthenticatorVariantEd25519(
      publicKey,
      signature,
    );
  const signedUserTransaction = new StarcoinTypes.SignedUserTransaction(
    rawTxn,
    transactionAuthenticatorVariantEd25519,
  );
  const se = new bcs.BcsSerializer();
  signedUserTransaction.serialize(se);
  const txid = CryptoHash.createUserTransactionHasher().crypto_hash(
    se.getBytes(),
  );
  const rawTx = hexUtils.hexlify(se.getBytes());

  return { txid, rawTx, encodedTx };
}
