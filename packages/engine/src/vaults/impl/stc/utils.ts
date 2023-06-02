/* eslint-disable camelcase */
import { arrayify, hexlify } from '@ethersproject/bytes';
import {
  bcs,
  crypto_hash,
  encoding,
  starcoin_types,
  utils,
} from '@starcoin/starcoin';
import axios from 'axios';
import BigNumber from 'bignumber.js';

import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import type { UnsignedTx } from '../../../types/provider';
import type { Token } from '../../../types/token';
import type { ISTCExplorerTransaction } from './types';

type IDecodedSTCPayload = {
  ScriptFunction: {
    func: {
      address: string;
      module: string;
      functionName: string;
    };
    args: Array<string>;
    // eslint-disable-next-line camelcase
    ty_args: Array<{
      Struct: { name: string; module: string; address: string };
    }>;
  };
};

type IDecodedTokenTransferPayload = {
  tokenAddress: string;
  to: string;
  amountValue: string;
};
type IDecodedOtherTxPayload = { name: string; params: any };
type IDecodedPayload =
  | { type: 'tokenTransfer'; payload: IDecodedTokenTransferPayload }
  | { type: 'other'; payload: IDecodedOtherTxPayload };

const historyAPIURLs: Record<string, string> = {
  [OnekeyNetwork.stc]: 'https://api.stcscan.io/v2/transaction/main/byAddress',
  [OnekeyNetwork.tstc]:
    'https://api.stcscan.io/v2/transaction/barnard/byAddress',
};

export async function getAddressHistoryFromExplorer(
  networkId: string,
  address: string,
): Promise<Array<ISTCExplorerTransaction>> {
  const urlBase = historyAPIURLs[networkId];
  if (typeof urlBase === 'undefined') {
    return Promise.resolve([]);
  }
  const requestURL = `${urlBase}/${address}`;
  try {
    const response = await axios.get<{
      contents: Array<ISTCExplorerTransaction>;
    }>(requestURL);
    return response.data.contents;
  } catch (e) {
    debugLogger.common.error(e);
    return Promise.resolve([]);
  }
}

function decodeDataAsTransfer(data: string) {
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
    debugLogger.common.error(e);
  }

  return ret;
}

// Codes based on starcoin-explorer,
// ref to https://github.com/starcoinorg/starcoin-explorer/blob/406da89d6af2d9d261aebe9fd4d85b23ba6ca2a8/src/modules/Transactions/components/TransactionSummary/TransferTransactionSummary.tsx#L69
export function extractTransactionInfo(tx: ISTCExplorerTransaction) {
  try {
    // Only care stc & token transfer now.
    const { to, tokenAddress, amountValue } = decodeDataAsTransfer(
      tx.user_transaction.raw_txn.payload,
    );

    return {
      from: tx.user_transaction.raw_txn.sender,
      to,
      tokenAddress,
      amountValue,
      feeValue: new BigNumber(tx.user_transaction.raw_txn.gas_unit_price)
        .times(tx.gas_used)
        .toFixed(),
    };
  } catch (e) {
    debugLogger.common.error(e);
    return null;
  }
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
    debugLogger.common.error('Failed to decode transaction data.', error, data);
  }
  return { type: 'other', payload: { name, params } };
}

export function encodeTokenTransferData(
  to: string,
  token: Token,
  amount: string,
): string {
  return encoding.bcsEncode(
    utils.tx.encodeScriptFunction(
      '0x00000000000000000000000000000001::TransferScripts::peer_to_peer_v2',
      utils.tx.encodeStructTypeTags([token.tokenIdOnNetwork]),
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

export const buildSignedTx = (
  senderPublicKey: string,
  rawSignature: Buffer,
  rawTxn: starcoin_types.RawUserTransaction,
) => {
  const publicKey = new starcoin_types.Ed25519PublicKey(
    Buffer.from(senderPublicKey, 'hex'),
  );
  const signature = new starcoin_types.Ed25519Signature(rawSignature);
  const transactionAuthenticatorVariantEd25519 =
    new starcoin_types.TransactionAuthenticatorVariantEd25519(
      publicKey,
      signature,
    );
  const signedUserTransaction = new starcoin_types.SignedUserTransaction(
    rawTxn,
    transactionAuthenticatorVariantEd25519,
  );
  const se = new bcs.BcsSerializer();
  signedUserTransaction.serialize(se);
  const txid = crypto_hash
    .createUserTransactionHasher()
    .crypto_hash(se.getBytes());
  const rawTx = hexlify(se.getBytes());

  return { txid, rawTx };
};

export const buildUnsignedRawTx = (
  unsignedTx: UnsignedTx,
  chainId: string,
): [starcoin_types.RawUserTransaction, Uint8Array] => {
  const fromAddr = unsignedTx.inputs[0].address;
  const { scriptFn, data } = unsignedTx.payload;

  const gasLimit = unsignedTx.feeLimit;
  const gasPrice = unsignedTx.feePricePerUnit;
  const { nonce } = unsignedTx;
  const { expirationTime } = unsignedTx.payload;

  if (
    !fromAddr ||
    !(scriptFn || data) ||
    !gasLimit ||
    !gasPrice ||
    typeof nonce === 'undefined'
  ) {
    throw new Error('invalid unsignedTx');
  }

  let txPayload: starcoin_types.TransactionPayload;
  if (scriptFn) {
    txPayload = scriptFn;
  } else {
    txPayload = encoding.bcsDecode(starcoin_types.TransactionPayload, data);
  }

  const rawTxn = utils.tx.generateRawUserTransaction(
    fromAddr,
    txPayload,
    gasLimit.toNumber(),
    gasPrice.toNumber(),
    nonce,
    expirationTime,
    Number(chainId),
  );

  const serializer = new bcs.BcsSerializer();
  rawTxn.serialize(serializer);

  return [rawTxn, serializer.getBytes()];
};
