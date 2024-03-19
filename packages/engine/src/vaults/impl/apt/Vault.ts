/* eslint-disable camelcase */
/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */

import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { AptosClient, BCS, TxnBuilderTypes } from 'aptos';
import BigNumber from 'bignumber.js';
import { get, groupBy, isEmpty, isNil } from 'lodash';

import { decrypt } from '@onekeyhq/engine/src/secret/encryptors/aes256';
import { TransactionStatus } from '@onekeyhq/engine/src/types/provider';
import type { PartialTokenInfo } from '@onekeyhq/engine/src/types/provider';
import type { Token } from '@onekeyhq/kit/src/store/typings';
import {
  getTimeDurationMs,
  getTimeStamp,
  isHexString,
} from '@onekeyhq/kit/src/utils/helper';
import { openDapp } from '@onekeyhq/kit/src/utils/openUrl';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';

import {
  InvalidAddress,
  InvalidTokenAddress,
  NotImplemented,
  OneKeyError,
  OneKeyInternalError,
} from '../../../errors';
import {
  IDecodedTxActionType,
  IDecodedTxDirection,
  IDecodedTxStatus,
} from '../../types';
import {
  convertFeeGweiToValue,
  convertFeeValueToGwei,
} from '../../utils/feeInfoUtils';
import { addHexPrefix, hexlify, stripHexPrefix } from '../../utils/hexUtils';
import { VaultBase } from '../../VaultBase';

import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import settings from './settings';
import {
  APTOS_COINSTORE,
  APTOS_NATIVE_COIN,
  APTOS_NATIVE_TRANSFER_FUNC,
  APTOS_TRANSFER_FUNC,
  DEFAULT_GAS_LIMIT_NATIVE_TRANSFER,
  DEFAULT_GAS_LIMIT_TRANSFER,
  buildSignedTx,
  convertRpcError,
  generateRegisterToken,
  generateTransferCoin,
  generateUnsignedTransaction,
  getAccountCoinResource,
  getAccountResource,
  getTokenInfo,
  getTransactionType,
  getTransactionTypeByPayload,
  waitPendingTransaction,
} from './utils';

import type { DBSimpleAccount } from '../../../types/account';
import type { KeyringSoftwareBase } from '../../keyring/KeyringSoftwareBase';
import type {
  IApproveInfo,
  IDecodedTx,
  IDecodedTxAction,
  IDecodedTxActionTokenTransfer,
  IDecodedTxLegacy,
  IEncodedTx,
  IEncodedTxUpdateOptions,
  IEncodedTxUpdatePayloadTransfer,
  IFeeInfo,
  IFeeInfoUnit,
  IHistoryTx,
  ISignedTxPro,
  ITransferInfo,
  IUnsignedTxPro,
} from '../../types';
import type { IEncodedTxAptos } from './types';

// @ts-ignore
export default class Vault extends VaultBase {
  keyringMap = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringWatching,
  };

  settings = settings;

  getClientCache = memoizee(async (rpcUrl) => this.getAptosClient(rpcUrl), {
    promise: true,
    max: 1,
    maxAge: getTimeDurationMs({ minute: 3 }),
  });

  async getClient() {
    const rpcURL = await this.getRpcUrl();
    return this.getClientCache(rpcURL);
  }

  getAptosClient(url: string) {
    // client: axios
    return new AptosClient(url);
  }

  // Chain only methods

  override async getClientEndpointStatus(
    url: string,
  ): Promise<{ responseTime: number; latestBlock: number }> {
    const client = await this.getClientCache(url);

    const start = performance.now();
    const { block_height: blockNumber } = await client.getLedgerInfo();
    const latestBlock = parseInt(blockNumber);
    return { responseTime: Math.floor(performance.now() - start), latestBlock };
  }

  async _getPublicKey({
    prefix = true,
  }: {
    prefix?: boolean;
  } = {}): Promise<string> {
    const dbAccount = (await this.getDbAccount()) as DBSimpleAccount;
    let publicKey = dbAccount.pub;
    if (prefix) {
      publicKey = addHexPrefix(publicKey);
    }
    return Promise.resolve(publicKey);
  }

  override async validateAddress(address: string) {
    if (!isHexString(address) || stripHexPrefix(address).length !== 64) {
      return Promise.reject(new InvalidAddress());
    }
    return Promise.resolve(address);
    // try {
    //   const exists = await this.checkAccountExistence(address);
    //   if (!exists) return await Promise.reject(new InvalidAccount());
    //   return await Promise.resolve(address);
    // } catch (e: any) {
    //   if (e instanceof InvalidAccount) return Promise.reject(e);
    //   return Promise.reject(new InvalidAddress());
    // }
  }

  override async validateWatchingCredential(input: string) {
    return this.validateAddress(input)
      .then((address) => this.settings.watchingAccountEnabled && !!address)
      .catch(() => false);
  }

  override async checkAccountExistence(address: string): Promise<boolean> {
    const client = await this.getClient();

    try {
      const accountData = await client.getAccount(stripHexPrefix(address));
      const authKey = get(accountData, 'authentication_key', null);
      return !isNil(authKey);
    } catch (error) {
      const errorCode = get(error, 'errorCode', null);
      if (errorCode === 'resource_not_found') {
        return false;
      }
      throw error;
    }
  }

  override async getBalances(
    requests: { address: string; tokenAddress?: string | undefined }[],
  ): Promise<(BigNumber | undefined)[]> {
    const client = await this.getClient();

    const requestAddress = groupBy(requests, (request) => request.address);

    const balances = new Map<string, BigNumber>();
    await Promise.all(
      Object.entries(requestAddress).map(async ([address, tokens]) => {
        try {
          const resources = await getAccountResource(client, address);
          tokens.forEach((req) => {
            const { tokenAddress } = req;
            const typeTag = `${APTOS_COINSTORE}<${
              tokenAddress ?? APTOS_NATIVE_COIN
            }>`;
            const accountResource = resources?.find((r) => r.type === typeTag);
            const balance = get(accountResource, 'data.coin.value', 0);
            const key = `${address}-${tokenAddress ?? APTOS_NATIVE_COIN}`;
            try {
              balances.set(key, new BigNumber(balance));
            } catch (e) {
              // ignore
            }
          });
        } catch (error) {
          // ignore account error
        }
      }),
    );

    return requests.map((req) => {
      const { address, tokenAddress } = req;
      const key = `${address}-${tokenAddress ?? APTOS_NATIVE_COIN}`;
      return balances.get(key) ?? new BigNumber(0);
    });
  }

  async fetchTokenInfos(
    tokenAddresses: string[],
  ): Promise<Array<PartialTokenInfo | undefined>> {
    const client = await this.getClient();

    return Promise.all(
      tokenAddresses.map(async (tokenAddress) => {
        try {
          return await getTokenInfo(client, tokenAddress);
        } catch (e) {
          // pass
        }
      }),
    );
  }

  override async activateAccount() {
    openDapp('https://aptoslabs.com/testnet-faucet');
  }

  override async activateToken(
    tokenAddress: string,
    password: string,
  ): Promise<boolean> {
    const { address } = (await this.getDbAccount()) as DBSimpleAccount;

    const resource = await getAccountCoinResource(
      await this.getClient(),
      address,
      tokenAddress,
    );

    if (resource) return Promise.resolve(true);

    const encodedTx: IEncodedTxAptos = generateRegisterToken(tokenAddress);
    encodedTx.sender = address;
    encodedTx.forcePendingTx = true;

    const unsignedTx = await this.buildUnsignedTxFromEncodedTx(encodedTx);
    unsignedTx.payload = {
      ...unsignedTx.payload,
      encodedTx,
    };

    const tx = await this.signAndSendTransaction(
      unsignedTx,
      {
        password,
      },
      false,
    );

    return !!tx.txid;
  }

  override async validateTokenAddress(tokenAddress: string): Promise<string> {
    const [address, module, name] = tokenAddress.split('::');

    if (module && name) {
      try {
        return `${(
          await this.validateAddress(
            hexlify(address, {
              hexPad: 'left',
            }),
          )
        ).toLowerCase()}::${module}::${name}`;
      } catch {
        // pass
      }
    }
    throw new InvalidTokenAddress();
  }

  override async attachFeeInfoToEncodedTx(params: {
    encodedTx: IEncodedTxAptos;
    feeInfoValue: IFeeInfoUnit;
  }): Promise<IEncodedTxAptos> {
    const { price, limit } = params.feeInfoValue;
    if (typeof price !== 'undefined' && typeof price !== 'string') {
      throw new OneKeyInternalError('Invalid gas price.');
    }
    if (typeof limit !== 'string') {
      throw new OneKeyInternalError('Invalid fee limit');
    }
    const network = await this.getNetwork();

    const txPrice = convertFeeGweiToValue({
      value: price || '0.000000001',
      network,
    });

    let { bscTxn } = params.encodedTx;
    if (!isNil(bscTxn) && !isEmpty(bscTxn)) {
      const deserializer = new BCS.Deserializer(hexToBytes(bscTxn));
      const rawTx = TxnBuilderTypes.RawTransaction.deserialize(deserializer);
      const newRawTx = new TxnBuilderTypes.RawTransaction(
        rawTx.sender,
        rawTx.sequence_number,
        rawTx.payload,
        BigInt(limit),
        BigInt(txPrice),
        rawTx.expiration_timestamp_secs,
        rawTx.chain_id,
      );

      const serializer = new BCS.Serializer();
      newRawTx.serialize(serializer);
      bscTxn = bytesToHex(serializer.getBytes());
    }

    const encodedTxWithFee = {
      ...params.encodedTx,
      gas_unit_price: txPrice,
      max_gas_amount: limit,
      bscTxn,
    };
    return Promise.resolve(encodedTxWithFee);
  }

  override decodedTxToLegacy(
    _decodedTx: IDecodedTx,
  ): Promise<IDecodedTxLegacy> {
    return Promise.resolve({} as IDecodedTxLegacy);
  }

  override async decodeTx(
    encodedTx: IEncodedTxAptos,
    _payload?: any,
  ): Promise<IDecodedTx> {
    const network = await this.engine.getNetwork(this.networkId);
    const dbAccount = (await this.getDbAccount()) as DBSimpleAccount;
    let token: Token | undefined = await this.engine.getNativeTokenInfo(
      this.networkId,
    );
    const { type, function: fun, type_arguments } = encodedTx;
    if (!encodedTx?.sender) {
      encodedTx.sender = dbAccount.address;
    }
    let action: IDecodedTxAction | null = null;
    const actionType = getTransactionTypeByPayload({
      type: type ?? 'entry_function_payload',
      function_name: fun,
      type_arguments,
    });

    if (
      actionType === IDecodedTxActionType.NATIVE_TRANSFER ||
      actionType === IDecodedTxActionType.TOKEN_TRANSFER
    ) {
      const isToken = actionType === IDecodedTxActionType.TOKEN_TRANSFER;

      // Native token transfer
      const { sender } = encodedTx;
      const [coinType] = encodedTx.type_arguments || [];
      const [to, amount] = encodedTx.arguments || [];
      let actionKey = 'nativeTransfer';

      if (isToken) {
        actionKey = 'tokenTransfer';
        token = await this.engine.ensureTokenInDB(this.networkId, coinType);
        if (!token) {
          const [remoteToken] = await this.fetchTokenInfos([coinType]);
          if (remoteToken) {
            token = {
              id: '1',
              isNative: false,
              networkId: this.networkId,
              tokenIdOnNetwork: coinType,
              name: remoteToken.name,
              symbol: remoteToken.symbol,
              decimals: remoteToken.decimals,
              logoURI: '',
            };
          }

          if (!token) {
            throw new Error('Invalid token address');
          }
        }
      }

      const transferAction: IDecodedTxActionTokenTransfer = {
        tokenInfo: token,
        from: sender ?? '',
        to,
        amount: new BigNumber(amount).shiftedBy(-token.decimals).toFixed(),
        amountValue: amount,
        extraInfo: null,
      };

      action = {
        type: actionType,
        [actionKey]: transferAction,
      };
    } else if (actionType === IDecodedTxActionType.FUNCTION_CALL) {
      action = {
        type: IDecodedTxActionType.FUNCTION_CALL,
        direction: IDecodedTxDirection.OTHER,
        functionCall: {
          target: encodedTx.sender,
          functionName: fun ?? '',
          args:
            encodedTx.arguments?.map((a) => {
              if (
                typeof a === 'string' ||
                typeof a === 'number' ||
                typeof a === 'boolean' ||
                typeof a === 'bigint'
              ) {
                return a.toString();
              }
              if (a instanceof Array) {
                try {
                  return hexlify(a);
                } catch (e) {
                  return JSON.stringify(a);
                }
              }
              return '';
            }) ?? [],
          extraInfo: {},
        },
      };
    } else {
      action = {
        type: IDecodedTxActionType.UNKNOWN,
        direction: IDecodedTxDirection.OTHER,
        unknownAction: { extraInfo: {} },
      };
    }

    const result: IDecodedTx = {
      txid: '',
      owner: dbAccount.address,
      signer: dbAccount.address,
      nonce: 0,
      actions: [action],
      status: IDecodedTxStatus.Pending, // TODO
      networkId: this.networkId,
      accountId: this.accountId,
      feeInfo: {
        price: convertFeeValueToGwei({
          value: encodedTx.gas_unit_price ?? '1',
          network,
        }),
        limit: encodedTx.max_gas_amount,
      },
      extraInfo: null,
      encodedTx,
    };

    return Promise.resolve(result);
  }

  override async buildEncodedTxFromTransfer(
    transferInfo: ITransferInfo,
  ): Promise<IEncodedTxAptos> {
    if (!transferInfo.to) {
      throw new Error('Invalid transferInfo.to params');
    }
    const { to, amount, token: tokenAddress } = transferInfo;
    const { address: from } = await this.getDbAccount();

    let amountValue;

    if (tokenAddress && tokenAddress !== '') {
      const token = await this.engine.ensureTokenInDB(
        this.networkId,
        tokenAddress,
      );

      if (typeof token === 'undefined') {
        throw new OneKeyInternalError('Failed to get token info.');
      }

      amountValue = new BigNumber(amount).shiftedBy(token.decimals).toFixed();
    } else {
      const network = await this.getNetwork();
      amountValue = new BigNumber(amount).shiftedBy(network.decimals).toFixed();
    }

    const encodedTx: IEncodedTxAptos = {
      ...generateTransferCoin(to, amountValue, tokenAddress),
      sender: from,
    };

    return encodedTx;
  }

  override buildEncodedTxFromApprove(
    _approveInfo: IApproveInfo,
  ): Promise<IEncodedTx> {
    // TODO
    throw new NotImplemented();
  }

  override updateEncodedTxTokenApprove(
    _encodedTx: IEncodedTx,
    _amount: string,
  ): Promise<IEncodedTx> {
    // TODO
    throw new NotImplemented();
  }

  override async updateEncodedTx(
    uncastedEncodedTx: IEncodedTx,
    payload: any,
    options: IEncodedTxUpdateOptions,
  ): Promise<IEncodedTx> {
    const encodedTx: IEncodedTxAptos = uncastedEncodedTx as IEncodedTxAptos;

    // max native token transfer update
    if (
      options.type === 'transfer' &&
      [APTOS_NATIVE_TRANSFER_FUNC, APTOS_TRANSFER_FUNC].includes(
        encodedTx?.function ?? '',
      )
    ) {
      const { decimals } = await this.engine.getNativeTokenInfo(this.networkId);
      const { amount } = payload as IEncodedTxUpdatePayloadTransfer;

      const [to] = encodedTx.arguments || [];
      encodedTx.arguments = [
        to,
        new BigNumber(amount).shiftedBy(decimals).toFixed(),
      ];
    }

    return Promise.resolve(encodedTx);
  }

  override async buildUnsignedTxFromEncodedTx(
    encodedTx: IEncodedTxAptos,
  ): Promise<IUnsignedTxPro> {
    const newEncodedTx = encodedTx;

    const expect = BigInt(Math.floor(Date.now() / 1000) + 100);
    if (!isNil(encodedTx.bscTxn) && !isEmpty(encodedTx.bscTxn)) {
      const deserializer = new BCS.Deserializer(hexToBytes(encodedTx.bscTxn));
      const rawTx = TxnBuilderTypes.RawTransaction.deserialize(deserializer);
      const newRawTx = new TxnBuilderTypes.RawTransaction(
        rawTx.sender,
        rawTx.sequence_number,
        rawTx.payload,
        rawTx.max_gas_amount,
        rawTx.gas_unit_price,
        rawTx.expiration_timestamp_secs > expect
          ? rawTx.expiration_timestamp_secs
          : expect,
        rawTx.chain_id,
      );

      const serializer = new BCS.Serializer();
      newRawTx.serialize(serializer);
      newEncodedTx.bscTxn = bytesToHex(serializer.getBytes());
    } else if (
      encodedTx.expiration_timestamp_secs &&
      BigInt(encodedTx.expiration_timestamp_secs) < expect
    ) {
      newEncodedTx.expiration_timestamp_secs = expect.toString();
    }

    const dbAccount = (await this.getDbAccount()) as DBSimpleAccount;
    return Promise.resolve({
      inputs: [
        {
          address: stripHexPrefix(dbAccount.address),
          value: new BigNumber(0),
          publicKey: stripHexPrefix(dbAccount.pub),
        },
      ],
      outputs: [],
      payload: { encodedTx: newEncodedTx },
      encodedTx: newEncodedTx,
    });
  }

  async fetchFeeInfo(
    encodedTx: IEncodedTxAptos,
    signOnly?: boolean,
  ): Promise<IFeeInfo> {
    const { max_gas_amount: gasLimit, ...encodedTxWithFakePriceAndNonce } = {
      ...encodedTx,
      gas_unit_price: '100',
    };

    const client = await this.getClient();
    const network = await this.getNetwork();

    let limit: string;
    let price: string;

    if (signOnly) {
      if (encodedTx.bscTxn && encodedTx.bscTxn?.length > 0) {
        const deserializer = new BCS.Deserializer(hexToBytes(encodedTx.bscTxn));
        const rawTx = TxnBuilderTypes.RawTransaction.deserialize(deserializer);

        limit = rawTx.max_gas_amount.toString();
        price = rawTx.gas_unit_price.toString();
      } else {
        // Sign only, Not necessarily accurate
        limit = encodedTx.gas_unit_price ?? DEFAULT_GAS_LIMIT_NATIVE_TRANSFER;
        price = encodedTx.gas_unit_price ?? '100';
      }

      return {
        nativeSymbol: network.symbol,
        nativeDecimals: network.decimals,
        feeSymbol: network.feeSymbol,
        feeDecimals: network.feeDecimals,

        limit,
        prices: [
          convertFeeValueToGwei({
            value: price,
            network,
          }),
        ],
        defaultPresetIndex: '0',
      };
    }

    const [gasPrice, unsignedTx] = await Promise.all([
      client.estimateGasPrice(),
      this.buildUnsignedTxFromEncodedTx(encodedTxWithFakePriceAndNonce),
    ]);

    try {
      let rawTx: TxnBuilderTypes.RawTransaction;
      const unSignedEncodedTx = unsignedTx.encodedTx as IEncodedTxAptos;
      if (unSignedEncodedTx.bscTxn && unSignedEncodedTx.bscTxn?.length > 0) {
        const deserializer = new BCS.Deserializer(
          hexToBytes(unSignedEncodedTx.bscTxn),
        );
        rawTx = TxnBuilderTypes.RawTransaction.deserialize(deserializer);
      } else {
        rawTx = await generateUnsignedTransaction(client, unsignedTx);
      }

      const invalidSigBytes = new Uint8Array(64);
      const { rawTx: rawSignTx } = await buildSignedTx(
        rawTx,
        unsignedTx.inputs?.[0].publicKey ?? '',
        bytesToHex(invalidSigBytes),
      );

      const tx = await (
        await this.getClient()
      ).submitBCSSimulation(hexToBytes(rawSignTx), {
        estimateGasUnitPrice: true,
        estimateMaxGasAmount: true,
      });

      // https://github.com/aptos-labs/aptos-core/blob/a1062d9ce2bb76990a84d068adb809f5932aeacb/developer-docs-site/docs/concepts/basics-gas-txn-fee.md#simulating-the-transaction-to-estimate-the-gas
      if (tx && tx.length !== 0) {
        const simulationTx = tx?.[0];

        const isOnekeyNativeTransfer =
          encodedTx.function === APTOS_NATIVE_TRANSFER_FUNC;

        const gasUsed = new BigNumber(simulationTx.gas_used);
        // Only onekey max send can pass, other cases must be simulated successfully
        if (
          gasUsed.isEqualTo(0) ||
          (!isOnekeyNativeTransfer && !simulationTx.success)
        ) {
          // Exec failure
          throw convertRpcError(simulationTx.vm_status);
        }

        limit = BigNumber.min(
          gasUsed.multipliedBy(2),
          new BigNumber(simulationTx.max_gas_amount),
        ).toFixed(0);

        price = convertFeeValueToGwei({
          value: simulationTx.gas_unit_price,
          network,
        });
      } else {
        throw new Error();
      }
    } catch (error) {
      if (error instanceof OneKeyError) {
        throw error;
      }

      if (
        encodedTx.function === APTOS_NATIVE_TRANSFER_FUNC ||
        encodedTx.function === APTOS_TRANSFER_FUNC
      ) {
        // Native transfer, give a default limit.
        limit = DEFAULT_GAS_LIMIT_NATIVE_TRANSFER;
      } else {
        limit = DEFAULT_GAS_LIMIT_TRANSFER;
      }
      price = convertFeeValueToGwei({
        value: gasPrice.gas_estimate.toString(),
        network,
      });
    }

    return {
      nativeSymbol: network.symbol,
      nativeDecimals: network.decimals,
      feeSymbol: network.feeSymbol,
      feeDecimals: network.feeDecimals,

      limit,
      prices: [price],
      defaultPresetIndex: '0',
    };
  }

  override async broadcastTransaction(
    signedTx: ISignedTxPro,
  ): Promise<ISignedTxPro> {
    const client = await this.getClient();

    debugLogger.engine.info('broadcastTransaction START:', {
      rawTx: signedTx.rawTx,
    });
    try {
      const { hash: txid } = await client.submitSignedBCSTransaction(
        hexToBytes(signedTx.rawTx),
      );

      debugLogger.engine.info('broadcastTransaction Done:', {
        txid,
        rawTx: signedTx.rawTx,
      });

      let pendingTx = true;
      try {
        // wait error or success
        await waitPendingTransaction(client, txid);
        pendingTx = false;
      } catch (error) {
        if (get(signedTx.encodedTx, 'forcePendingTx', false)) {
          debugLogger.engine.info('broadcastTransaction wait Pending Error:', {
            txid,
            rawTx: signedTx.rawTx,
          });
          throw error;
        }
      }

      debugLogger.engine.info('broadcastTransaction wait Pending END:', {
        txid,
        rawTx: signedTx.rawTx,
      });
      return {
        ...signedTx,
        pendingTx,
        txid,
      };
    } catch (error: any) {
      // It's already been dealt with in the waitPendingTransaction
      if (error instanceof OneKeyInternalError) {
        throw error;
      }

      const { message } = error || {};
      throw convertRpcError(message);
    }
  }

  async getExportedCredential(password: string): Promise<string> {
    const dbAccount = await this.getDbAccount();
    if (dbAccount.id.startsWith('hd-') || dbAccount.id.startsWith('imported')) {
      const keyring = this.keyring as KeyringSoftwareBase;
      const [encryptedPrivateKey] = Object.values(
        await keyring.getPrivateKeys(password),
      );
      return `0x${decrypt(password, encryptedPrivateKey).toString('hex')}`;
    }
    throw new OneKeyInternalError(
      'Only credential of HD or imported accounts can be exported',
    );
  }

  override async fetchOnChainHistory(options: {
    tokenIdOnNetwork?: string;
    localHistory?: IHistoryTx[];
  }): Promise<IHistoryTx[]> {
    const { localHistory = [], tokenIdOnNetwork } = options;
    if (tokenIdOnNetwork) {
      // No token support now.
      return Promise.resolve([]);
    }

    const client = await this.getClient();
    const dbAccount = (await this.getDbAccount()) as DBSimpleAccount;
    const { decimals } = await this.engine.getNativeTokenInfo(this.networkId);

    const explorerTxs = await client.getAccountTransactions(dbAccount.address);

    const promises = explorerTxs.map(async (tx) => {
      const historyTxToMerge = localHistory.find(
        (item) => item.decodedTx.txid === tx.hash,
      );
      if (historyTxToMerge && historyTxToMerge.decodedTx.isFinal) {
        // No need to update.
        return Promise.resolve(null);
      }

      try {
        const {
          arguments: args,
          type_arguments: types,
          function: func,
          code,
          // @ts-expect-error
        } = tx?.payload || {};

        // @ts-expect-error
        if (!tx?.payload) return await Promise.resolve(null);

        const [coinType] = types;

        const from = get(tx, 'sender', undefined);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, no-unsafe-optional-chaining
        const [moveAddr] = func?.split('::');

        const actionType = getTransactionType(tx);

        const encodedTx = {
          from,
          to: moveAddr,
          value: '',
        };

        let action: IDecodedTxAction = {
          type: IDecodedTxActionType.UNKNOWN,
        };

        if (
          actionType === IDecodedTxActionType.NATIVE_TRANSFER ||
          actionType === IDecodedTxActionType.TOKEN_TRANSFER
        ) {
          const [to, amountValue] = args || [];
          const isToken = actionType === IDecodedTxActionType.TOKEN_TRANSFER;

          let direction = IDecodedTxDirection.IN;
          if (from === dbAccount.address) {
            direction =
              to === dbAccount.address
                ? IDecodedTxDirection.SELF
                : IDecodedTxDirection.OUT;
          }

          let token: Token | undefined = await this.engine.getNativeTokenInfo(
            this.networkId,
          );
          let actionKey = 'nativeTransfer';
          if (isToken) {
            actionKey = 'tokenTransfer';
            token = await this.engine.ensureTokenInDB(this.networkId, coinType);
            if (typeof token === 'undefined') {
              throw new OneKeyInternalError('Failed to get token info.');
            }
          } else {
            encodedTx.to = to;
            encodedTx.value = amountValue;
          }

          action = {
            type: actionType,
            direction,
            [actionKey]: {
              tokenInfo: token,
              from,
              to,
              amount: new BigNumber(amountValue)
                .shiftedBy(-token.decimals)
                .toFixed(),
              amountValue,
              extraInfo: null,
            },
          };
        } else if (actionType === IDecodedTxActionType.TOKEN_ACTIVATE) {
          const token = await this.engine.ensureTokenInDB(
            this.networkId,
            coinType,
          );
          let tokenInfo = {
            name: token?.name ?? '',
            symbol: token?.symbol ?? '',
            decimals: token?.decimals ?? 6,
            logoURI: token?.logoURI ?? '',
          };

          if (typeof token === 'undefined') {
            tokenInfo = {
              ...(await getTokenInfo(client, coinType)),
              logoURI: '',
            };
          }

          action = {
            type: actionType,
            tokenActivate: {
              ...tokenInfo,
              tokenAddress: coinType,
              networkId: this.networkId,
              extraInfo: null,
            },
          };
        } else if (actionType === IDecodedTxActionType.FUNCTION_CALL) {
          action = {
            type: IDecodedTxActionType.FUNCTION_CALL,
            direction: IDecodedTxDirection.OTHER,
            functionCall: {
              target: from,
              functionName: func ?? '',
              args,
              extraInfo: {},
            },
          };
        }

        const feeValue = new BigNumber(get(tx, 'gas_used', 0)).multipliedBy(
          get(tx, 'gas_unit_price', 0),
        );

        const success = get(tx, 'success', undefined);
        let status = IDecodedTxStatus.Pending;
        if (success === false) {
          status = IDecodedTxStatus.Failed;
        } else if (success === true) {
          status = IDecodedTxStatus.Confirmed;
        }

        const decodedTx: IDecodedTx = {
          txid: tx.hash,
          owner: dbAccount.address,
          signer: from,
          nonce: 0,
          actions: [action],
          status,
          networkId: this.networkId,
          accountId: this.accountId,
          encodedTx,
          extraInfo: null,
          totalFeeInNative: new BigNumber(feeValue)
            .shiftedBy(-decimals)
            .toFixed(),
        };
        decodedTx.updatedAt = get(tx, 'timestamp', getTimeStamp()) / 1000;
        decodedTx.createdAt =
          historyTxToMerge?.decodedTx.createdAt ?? decodedTx.updatedAt;
        decodedTx.isFinal = decodedTx.status === IDecodedTxStatus.Confirmed;
        return await this.buildHistoryTx({
          decodedTx,
          historyTxToMerge,
        });
      } catch (e) {
        debugLogger.common.error(e);
      }

      return Promise.resolve(null);
    });

    return (await Promise.all(promises)).filter(Boolean);
  }

  override async getTransactionStatuses(
    txids: Array<string>,
  ): Promise<Array<TransactionStatus | undefined>> {
    const client = await this.getClient();

    return Promise.all(
      txids.map(async (txid) => {
        try {
          const tx = await client.getTransactionByHash(txid);
          const success = get(tx, 'success', undefined);
          let status = TransactionStatus.PENDING;
          if (success === false) {
            status = TransactionStatus.CONFIRM_BUT_FAILED;
          } else if (success === true) {
            status = TransactionStatus.CONFIRM_AND_SUCCESS;
          }
          return await Promise.resolve(status);
        } catch (error: any) {
          const { errorCode } = error;
          if (errorCode === 'transaction_not_found') {
            return Promise.resolve(TransactionStatus.NOT_FOUND);
          }
        }
      }),
    );
  }

  async getTransactionByHash(txId: string) {
    const client = await this.getClient();
    return client.getTransactionByHash(txId);
  }
}
