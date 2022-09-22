import {
  SignedTx,
  UnsignedTx,
} from '@onekeyfe/blockchain-libs/dist/types/provider';
/* eslint-disable camelcase */
/* eslint-disable @typescript-eslint/naming-convention */
import {
  AptosClient,
  BCS,
  RemoteABIBuilderConfig,
  TransactionBuilder,
  TransactionBuilderRemoteABI,
  TxnBuilderTypes,
  Types,
  bytesToHex,
  hexToBytes,
} from 'aptos';
import { get } from 'lodash';

import { OneKeyError, OneKeyHardwareError } from '../../../errors';
import { IDecodedTxActionType } from '../../types';
import { hexlify, stripHexPrefix } from '../../utils/hexUtils';

import { TxPayload } from './types';

import type { Signer } from '../../../proxy';

// Move Module
export const APTOS_COINSTORE = '0x1::coin::CoinStore';
export const APTOS_COIN_INFO = '0x1::coin::CoinInfo';

// Move Action Module
export const APTOS_PUBLISH_MODULE = '0x1::code::publish_package_txn';
export const APTOS_TRANSFER_FUNC = '0x1::coin::transfer';
export const APTOS_TOKEN_REGISTER = '0x1::managed_coin::register';
export const APTOS_NFT_CREATE = '0x3::token::create_token_script';
export const APTOS_NFT_CLAIM = '0x3::token_transfers::claim_script';

export const APTOS_NATIVE_COIN = '0x1::aptos_coin::AptosCoin';
export const DEFAULT_GAS_LIMIT_NATIVE_TRANSFER = '2000';

const POLL_INTERVAL = 1500;
type IPollFn<T> = (time?: number, index?: number) => T;

export function getTransactionType(
  transaction: Types.Transaction,
): IDecodedTxActionType {
  // TODO other transaction type
  if (transaction.type === 'user_transaction') {
    const tx = transaction as Types.UserTransaction;

    if (tx.payload.type === 'entry_function_payload') {
      const payload = tx.payload as Types.EntryFunctionPayload;

      if (payload.function === APTOS_TRANSFER_FUNC) {
        const [tokenName] = payload.type_arguments;
        if (tokenName === APTOS_NATIVE_COIN) {
          return IDecodedTxActionType.NATIVE_TRANSFER;
        }
        return IDecodedTxActionType.TOKEN_TRANSFER;
      }
      if (payload.function === APTOS_TOKEN_REGISTER) {
        return IDecodedTxActionType.TOKEN_ACTIVATE;
      }

      // TODO NFT transfer

      return IDecodedTxActionType.FUNCTION_CALL;
    }

    return IDecodedTxActionType.UNKNOWN;
  }

  return IDecodedTxActionType.UNKNOWN;
}

export async function getTokenInfo(client: AptosClient, tokenAddress: string) {
  const [address] = tokenAddress.split('::');
  const { data } = await client.getAccountResource(
    address,
    `${APTOS_COIN_INFO}<${tokenAddress ?? APTOS_NATIVE_COIN}>`,
  );

  return Promise.resolve({
    name: get(data, 'name', ''),
    symbol: get(data, 'symbol', ''),
    decimals: get(data, 'decimals', 6),
  });
}

export async function generateSignTransaction(
  client: AptosClient,
  signer: Signer,
  sender: string,
  senderPublicKey: string,
  payload: TxPayload,
  options?: {
    sequence_number?: string;
    max_gas_amount?: string;
    gas_unit_price?: string;
    expiration_timestamp_secs?: string;
    chain_id?: number;
  },
) {
  const config: RemoteABIBuilderConfig = { sender };
  if (options?.sequence_number) {
    config.sequenceNumber = options?.sequence_number;
  }
  if (options?.gas_unit_price) {
    config.gasUnitPrice = options?.gas_unit_price;
  }
  if (options?.max_gas_amount) {
    config.maxGasAmount = options?.max_gas_amount;
  }
  if (options?.expiration_timestamp_secs) {
    const timestamp = Number.parseInt(options?.expiration_timestamp_secs, 10);
    config.expSecFromNow = timestamp - Math.floor(Date.now() / 1000);
  }

  const builder = new TransactionBuilderRemoteABI(client, config);

  const rawTxn = await builder.build(
    payload.function ?? '',
    payload.type_arguments ?? [],
    payload.arguments ?? [],
  );

  const signingMessage = TransactionBuilder.getSigningMessage(rawTxn);
  const [signature] = await signer.sign(
    Buffer.from(bytesToHex(signingMessage), 'hex'),
  );

  const signatureHex = hexlify(signature, {
    noPrefix: true,
  });
  const txSignature = new TxnBuilderTypes.Ed25519Signature(
    hexToBytes(signatureHex),
  );

  const authenticator = new TxnBuilderTypes.TransactionAuthenticatorEd25519(
    new TxnBuilderTypes.Ed25519PublicKey(
      hexToBytes(stripHexPrefix(senderPublicKey)),
    ),
    txSignature,
  );

  const signRawTx = BCS.bcsToBytes(
    new TxnBuilderTypes.SignedTransaction(rawTxn, authenticator),
  );

  return Promise.resolve({
    txid: '',
    rawTx: bytesToHex(signRawTx),
  });
}

export async function signTransaction(
  client: AptosClient,
  unsignedTx: UnsignedTx,
  signer: Signer,
): Promise<SignedTx> {
  // IEncodedTxAptos
  const { encodedTx } = unsignedTx.payload;
  const {
    sender,
    sequence_number,
    max_gas_amount,
    gas_unit_price,
    expiration_timestamp_secs,

    //  payload
    type,
    function: func,
    arguments: args,
    type_arguments,
    code,
  } = encodedTx;

  const senderPublicKey = unsignedTx.inputs?.[0]?.publicKey;

  if (!senderPublicKey) {
    throw new OneKeyHardwareError(Error('senderPublicKey is required'));
  }

  return generateSignTransaction(
    client,
    signer,
    sender,
    senderPublicKey,
    {
      type,
      function: func,
      arguments: args,
      type_arguments,
      code,
    },
    {
      sequence_number,
      max_gas_amount,
      gas_unit_price,
      expiration_timestamp_secs,
    },
  );
}

export function waitPendingTransaction(
  client: AptosClient,
  txHash: string,
  retryCount = 10,
): Promise<Types.Transaction | undefined> {
  let retry = 0;

  const poll: IPollFn<Promise<Types.Transaction | undefined>> = async (
    time = POLL_INTERVAL,
  ) => {
    retry += 1;

    let transaction: Types.Transaction | undefined;
    try {
      transaction = await client.getTransactionByHash(txHash);
    } catch (error: any) {
      const { errorCode } = error;
      return Promise.reject(new OneKeyError(errorCode));
    }

    const success = get(transaction, 'success', undefined);
    if (success === true) {
      return Promise.resolve(transaction);
    }
    if (success === false) {
      return Promise.reject(
        new OneKeyError(get(transaction, 'vm_status', undefined)),
      );
    }
    if (retry > retryCount) {
      return Promise.resolve(transaction);
    }

    return new Promise(
      (resolve: (p: Promise<Types.Transaction | undefined>) => void) =>
        setTimeout(() => resolve(poll(time)), time),
    );
  };

  return poll();
}

export async function getAccountCoinResource(
  client: AptosClient,
  address: string,
  tokenAddress?: string | undefined,
): Promise<Types.MoveResource | undefined> {
  // The coin type to use, defaults to 0x1::aptos_coin::AptosCoin
  const typeTag = `${APTOS_COINSTORE}<${tokenAddress ?? APTOS_NATIVE_COIN}>`;
  const resources = await client.getAccountResources(stripHexPrefix(address));
  const accountResource = resources.find((r) => r.type === typeTag);
  return Promise.resolve(accountResource);
}

export function generateRegisterToken(tokenAddress: string): TxPayload {
  return {
    type: 'entry_function_payload',
    function: APTOS_TOKEN_REGISTER,
    arguments: [],
    type_arguments: [tokenAddress],
  };
}

export function generateTransferCoin(
  to: string,
  amount: string,
  tokenAddress?: string,
): TxPayload {
  return {
    type: 'entry_function_payload',
    function: APTOS_TRANSFER_FUNC,
    arguments: [to, amount],
    type_arguments: [tokenAddress ?? APTOS_NATIVE_COIN],
  };
}
