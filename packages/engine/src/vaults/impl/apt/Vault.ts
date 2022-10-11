/* eslint-disable camelcase */
/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */

import { hexToBytes } from '@noble/hashes/utils';
import { BaseClient } from '@onekeyfe/blockchain-libs/dist/provider/abc';
import { decrypt } from '@onekeyfe/blockchain-libs/dist/secret/encryptors/aes256';
import {
  PartialTokenInfo,
  TransactionStatus,
} from '@onekeyfe/blockchain-libs/dist/types/provider';
import { AptosClient } from 'aptos';
import BigNumber from 'bignumber.js';
import { get, isNil } from 'lodash';
import memoizee from 'memoizee';

import { Token } from '@onekeyhq/kit/src/store/typings';
import { getTimeStamp } from '@onekeyhq/kit/src/utils/helper';
import { openDapp } from '@onekeyhq/kit/src/utils/openUrl';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import {
  InvalidAccount,
  InvalidAddress,
  InvalidTokenAddress,
  NotImplemented,
  OneKeyInternalError,
} from '../../../errors';
import { DBSimpleAccount } from '../../../types/account';
import { KeyringSoftwareBase } from '../../keyring/KeyringSoftwareBase';
import {
  IApproveInfo,
  IDecodedTx,
  IDecodedTxAction,
  IDecodedTxActionTokenTransfer,
  IDecodedTxActionType,
  IDecodedTxDirection,
  IDecodedTxLegacy,
  IDecodedTxStatus,
  IEncodedTx,
  IEncodedTxUpdateOptions,
  IEncodedTxUpdatePayloadTransfer,
  IFeeInfo,
  IFeeInfoUnit,
  IHistoryTx,
  ISignCredentialOptions,
  ISignedTx,
  ITransferInfo,
  IUnsignedTxPro,
} from '../../types';
import {
  convertFeeGweiToValue,
  convertFeeValueToGwei,
} from '../../utils/feeInfoUtils';
import { addHexPrefix, stripHexPrefix } from '../../utils/hexUtils';
import { VaultBase } from '../../VaultBase';

import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import settings from './settings';
import { IEncodedTxAptos } from './types';
import {
  APTOS_NATIVE_COIN,
  APTOS_TRANSFER_FUNC,
  DEFAULT_GAS_LIMIT_NATIVE_TRANSFER,
  generateRegisterToken,
  getAccountCoinResource,
  getTokenInfo,
  getTransactionType,
  getTransactionTypeByPayload,
  waitPendingTransaction,
} from './utils';

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
  });

  async getClient() {
    const { rpcURL } = await this.engine.getNetwork(this.networkId);
    return this.getClientCache(rpcURL);
  }

  getAptosClient(url: string) {
    return new AptosClient(url);
  }

  // Chain only methods

  override createClientFromURL(_url: string): BaseClient {
    // This isn't needed.
    throw new NotImplemented();
  }

  override async getClientEndpointStatus(
    url: string,
  ): Promise<{ responseTime: number; latestBlock: number }> {
    const client = this.getAptosClient(url);

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
    // if (isHexString(address) && stripHexPrefix(address).length !== 64) {
    //   return await Promise.reject(new InvalidAddress());
    // }
    try {
      const exists = await this.checkAccountExistence(address);
      if (!exists) return await Promise.reject(new InvalidAccount());
      return await Promise.resolve(address);
    } catch (e: any) {
      if (e instanceof InvalidAccount) return Promise.reject(e);
      return Promise.reject(new InvalidAddress());
    }
  }

  override validateWatchingCredential(input: string) {
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

    return Promise.all(
      requests.map(async ({ address, tokenAddress }) => {
        try {
          const accountResource = await getAccountCoinResource(
            client,
            address,
            tokenAddress,
          );
          const balance = get(accountResource, 'data.coin.value', 0);
          return new BigNumber(balance);
        } catch (error: any) {
          if (error instanceof InvalidAccount) {
            return Promise.resolve(new BigNumber(0));
          }
          // pass
        }
      }),
    );
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
          await this.validateAddress(address)
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

    // TODO: Dapp transaction edit fee

    const encodedTxWithFee = {
      ...params.encodedTx,
      gas_unit_price: convertFeeGweiToValue({
        value: price || '0.000000001',
        network,
      }),
      max_gas_amount: limit,
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
      type,
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
    } else {
      action = {
        type: IDecodedTxActionType.UNKNOWN,
        direction: IDecodedTxDirection.OTHER,
        unknownAction: {
          extraInfo: {},
        },
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
    const { to, amount, token: tokenAddress } = transferInfo;
    const { address: from } = await this.getDbAccount();

    let amountValue;
    let argumentsType: any[];
    if (tokenAddress && tokenAddress !== '') {
      const token = await this.engine.ensureTokenInDB(
        this.networkId,
        tokenAddress,
      );

      if (typeof token === 'undefined') {
        throw new OneKeyInternalError('Failed to get token info.');
      }

      amountValue = new BigNumber(amount).shiftedBy(token.decimals).toFixed();
      argumentsType = [tokenAddress];
    } else {
      const network = await this.getNetwork();
      amountValue = new BigNumber(amount).shiftedBy(network.decimals).toFixed();
      argumentsType = [APTOS_NATIVE_COIN];
    }

    const encodedTx: IEncodedTxAptos = {
      type: 'entry_function_payload',
      function: APTOS_TRANSFER_FUNC,
      arguments: [to, amountValue],
      type_arguments: argumentsType,
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
      encodedTx.function === APTOS_TRANSFER_FUNC
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
      payload: { encodedTx },
      encodedTx,
    });
  }

  async fetchFeeInfo(encodedTx: IEncodedTxAptos): Promise<IFeeInfo> {
    const { max_gas_amount: gasLimit, ...encodedTxWithFakePriceAndNonce } = {
      ...encodedTx,
      gas_unit_price: '1',
    };

    const client = await this.getClient();

    const [network, gasPrice, unsignedTx] = await Promise.all([
      this.getNetwork(),
      client.client.transactions.estimateGasPrice(),
      this.buildUnsignedTxFromEncodedTx(encodedTxWithFakePriceAndNonce),
    ]);

    let limit = BigNumber.max(
      unsignedTx.feeLimit ?? '0',
      gasLimit ?? '0',
    ).toFixed();

    const price = convertFeeValueToGwei({
      value: gasPrice.gas_estimate.toString(),
      network,
    });

    if (limit === '0') {
      // Dry run failed.

      // Native transfer, give a default limit.
      limit = DEFAULT_GAS_LIMIT_NATIVE_TRANSFER;
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

  override async signAndSendTransaction(
    unsignedTx: IUnsignedTxPro,
    options: ISignCredentialOptions,
    _signOnly: boolean,
  ): Promise<ISignedTx> {
    const client = await this.getClient();
    const signedTx = await this.signTransaction(unsignedTx, options);
    try {
      const ret = await client.submitSignedBCSTransaction(
        hexToBytes(signedTx.rawTx),
      );

      // wait error or success
      await waitPendingTransaction(client, ret.hash);

      return {
        ...signedTx,
        txid: ret.hash,
        encodedTx: unsignedTx.encodedTx,
      };
    } catch (error: any) {
      const { errorCode, message } = error || {};
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      throw new OneKeyInternalError(`${errorCode ?? ''} ${message}`);
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
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

              extraInfo: null,
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
