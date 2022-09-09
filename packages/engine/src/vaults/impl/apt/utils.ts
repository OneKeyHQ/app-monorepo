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

import type { Signer } from '../../../proxy';

// Move Module
export const APTOS_COINSTORE = '0x1::coin::CoinStore';

// Move Action Module
export const APTOS_PUBLISH_MODULE = '0x1::code::publish_package_txn';
export const APTOS_TRANSFER_FUNC = '0x1::coin::transfer';
export const APTOS_TOKEN_REGISTER = '0x1::managed_coin::register';
export const APTOS_NFT_CREATE = '0x3::token::create_token_script';
export const APTOS_NFT_CLAIM = '0x3::token_transfers::claim_script';

export const APTOS_NATIVE_COIN = '0x1::aptos_coin::AptosCoin';
export const DEFAULT_GAS_LIMIT_NATIVE_TRANSFER = '2000';

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
        // TODO Token register
      }

      // TODO NFT transfer

      return IDecodedTxActionType.FUNCTION_CALL;
    }

    return IDecodedTxActionType.UNKNOWN;
  }

  return IDecodedTxActionType.UNKNOWN;
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
    chain_id,

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

  const config: RemoteABIBuilderConfig = { sender };
  if (sequence_number) {
    config.sequenceNumber = sequence_number;
  }

  if (gas_unit_price) {
    config.gasUnitPrice = gas_unit_price;
  }

  if (max_gas_amount) {
    config.maxGasAmount = max_gas_amount;
  }

  if (expiration_timestamp_secs) {
    const timestamp = Number.parseInt(expiration_timestamp_secs, 10);
    config.expSecFromNow = timestamp - Math.floor(Date.now() / 1000);
  }

  const builder = new TransactionBuilderRemoteABI(client, config);

  const rawTxn = await builder.build(func, type_arguments, args);

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

const POLL_INTERVAL = 1500;
type IPollFn<T> = (time?: number, index?: number) => T;

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
