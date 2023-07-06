/* eslint-disable camelcase */
import { arrayify, hexlify } from '@ethersproject/bytes';
import axios from 'axios';
import BigNumber from 'bignumber.js';

import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import { check } from '@onekeyhq/shared/src/utils/assertUtils';

import { Verifier } from '../../../proxy';

import { CryptoHash, StarcoinTypes, bcs, encoding, utils } from './sdk';

import type { AddressValidation, UnsignedTx } from '../../../types/provider';
import type { Token } from '../../../types/token';
import type { ClientStc } from './sdk';
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
  rawTxn: StarcoinTypes.RawUserTransaction,
) => {
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
  const rawTx = hexlify(se.getBytes());

  return { txid, rawTx, signature: rawSignature };
};

export const buildUnsignedRawTx = (
  unsignedTx: UnsignedTx,
  chainId: string,
): [StarcoinTypes.RawUserTransaction, Uint8Array] => {
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

  let txPayload: StarcoinTypes.TransactionPayload;
  if (scriptFn) {
    txPayload = scriptFn;
  } else {
    txPayload = encoding.bcsDecode(StarcoinTypes.TransactionPayload, data);
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

export const pubkeyToAddress = async (
  pub: string,
  encodingType = 'hex',
): Promise<string> => {
  const verifier = new Verifier(pub, 'ed25519');
  let address = '';
  const pubkeyBytes = await verifier.getPubkey();
  if (encodingType === 'hex') {
    address = encoding.publicKeyToAddress(pubkeyBytes.toString('hex'));
  } else if (encodingType === 'bech32') {
    address = encoding.publicKeyToReceiptIdentifier(
      pubkeyBytes.toString('hex'),
    );
  } else {
    throw new Error('invalid encoding');
  }
  return address;
};

export const verifyAddress = (address: string): AddressValidation => {
  if (address.startsWith('stc')) {
    try {
      const riv = encoding.decodeReceiptIdentifier(address);
      return {
        normalizedAddress: `0x${riv.accountAddress}`,
        displayAddress: address,
        isValid: true,
        encoding: 'bech32',
      };
    } catch (error) {
      // pass
    }
  } else {
    try {
      const normalizedAddress = address.startsWith('0x')
        ? address.toLowerCase()
        : `0x${address.toLowerCase()}`;
      const accountAddress = encoding.addressToSCS(normalizedAddress);
      // in order to check invalid address length, because the auto padding 0 at head of address
      if (encoding.addressFromSCS(accountAddress) === normalizedAddress) {
        return {
          normalizedAddress,
          displayAddress: normalizedAddress,
          isValid: true,
          encoding: 'hex',
        };
      }
    } catch (error) {
      // pass
    }
  }

  return {
    isValid: false,
  };
};

export const hashRawTx = (rawUserTransactionBytes: Uint8Array): Uint8Array => {
  const hashSeedBytes = CryptoHash.createRawUserTransactionHasher().get_salt();
  return Uint8Array.of(...hashSeedBytes, ...rawUserTransactionBytes);
};

export const buildUnsignedTx = async (
  unsignedTx: UnsignedTx,
  client: ClientStc,
  chainId: string,
): Promise<UnsignedTx> => {
  const feePricePerUnit = unsignedTx.feePricePerUnit
    ? unsignedTx.feePricePerUnit
    : (await client.getFeePricePerUnit()).normal.price;
  const txInput = unsignedTx.inputs[0];
  const txOutput = unsignedTx.outputs[0];
  const payload = unsignedTx.payload || {};

  const { nonce } = unsignedTx;
  let { feeLimit } = unsignedTx;
  const fromAddr = txInput.address;
  let txPayload: StarcoinTypes.TransactionPayload;

  if (txInput && txOutput) {
    let toAddr = txOutput.address;
    const amount = txOutput.value;
    const { tokenAddress } = txOutput;
    if (toAddr.startsWith('stc')) {
      const riv = encoding.decodeReceiptIdentifier(toAddr);
      toAddr = riv.accountAddress.startsWith('0x')
        ? riv.accountAddress
        : `0x${riv.accountAddress}`;
    }
    const typeArgs = [tokenAddress ?? '0x1::STC::STC'];
    const functionId = '0x1::TransferScripts::peer_to_peer_v2';
    const args = [toAddr, BigInt(amount.toNumber())];
    const nodeUrl = client.rpc?.url;
    const scriptFunction = (await utils.tx.encodeScriptFunctionByResolve(
      functionId,
      typeArgs,
      args,
      nodeUrl,
    )) as StarcoinTypes.TransactionPayload;
    payload.scriptFn = scriptFunction;
    txPayload = scriptFunction;
  } else if (payload.data) {
    txPayload = encoding.bcsDecode(
      StarcoinTypes.TransactionPayload,
      payload.data,
    );
  } else {
    // should not be here
    throw new Error('invalid unsignedTx payload');
  }
  const senderPublicKey = txInput.publicKey || '';
  if (!feeLimit) {
    check(senderPublicKey, 'senderPublicKey is required');
  }
  if (typeof nonce === 'undefined') {
    throw new Error('nonce is not available');
  }
  payload.expirationTime =
    payload.expirationTime || Math.floor(Date.now() / 1000) + 60 * 60;

  const maxGasAmount = 10000000;
  const gasUnitPrice = feePricePerUnit.toNumber();
  const expirationTimestampSecs =
    payload.expirationTime || Math.floor(Date.now() / 1000) + 60 * 60;
  const rawUserTransaction = utils.tx.generateRawUserTransaction(
    fromAddr,
    txPayload,
    maxGasAmount,
    gasUnitPrice,
    nonce as number | bigint,
    expirationTimestampSecs,
    Number(chainId),
  );

  const rawUserTransactionHex = encoding.bcsEncode(rawUserTransaction);

  let tokensChangedTo;

  if (!feeLimit) {
    const result = await client.estimateGasLimitAndTokensChangedTo(
      rawUserTransactionHex,
      senderPublicKey,
    );
    feeLimit = result.feeLimit;
    tokensChangedTo = result.tokensChangedTo;
  }
  return {
    inputs: txInput ? [txInput] : [],
    outputs: txOutput ? [txOutput] : [],
    feeLimit,
    tokensChangedTo,
    feePricePerUnit,
    nonce,
    payload,
  };
};
