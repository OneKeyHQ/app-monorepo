/* eslint no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */
/* eslint @typescript-eslint/no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { decrypt } from '@onekeyfe/blockchain-libs/dist/secret/encryptors/aes256';
import { TransactionStatus } from '@onekeyfe/blockchain-libs/dist/types/provider';
import * as sdk from 'algosdk';
import BigNumber from 'bignumber.js';
import memoizee from 'memoizee';

import { getTimeDurationMs } from '@onekeyhq/kit/src/utils/helper';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import {
  InvalidAddress,
  InvalidTokenAddress,
  MimimumBalanceRequired,
  NotImplemented,
  OneKeyInternalError,
  RecipientHasNotActived,
} from '../../../errors';
import {
  IDecodedTxActionType,
  IDecodedTxDirection,
  IDecodedTxStatus,
  IEncodedTxUpdateType,
} from '../../types';
import { VaultBase } from '../../VaultBase';

import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import settings from './settings';
import { encodeTransaction } from './utils';

import type { DBSimpleAccount } from '../../../types/account';
import type { KeyringSoftwareBase } from '../../keyring/KeyringSoftwareBase';
import type {
  IApproveInfo,
  IDecodedTx,
  IDecodedTxAction,
  IDecodedTxLegacy,
  IEncodedTxUpdateOptions,
  IEncodedTxUpdatePayloadTransfer,
  IFeeInfo,
  IFeeInfoUnit,
  IHistoryTx,
  ISignedTx,
  ITransferInfo,
  IUnsignedTxPro,
} from '../../types';
import type {
  IAccountInformation,
  IAccountTransactionsResp,
  IClientError,
  IEncodedTxAlgo,
  IPendingTransactionInformation,
} from './types';
import type { BaseClient } from '@onekeyfe/blockchain-libs/dist/provider/abc';
import type { PartialTokenInfo } from '@onekeyfe/blockchain-libs/dist/types/provider';

const ASSET_ID_END_BOUNDARY = new BigNumber('0x10000000000000000');

const MINIMUM_BALANCE_REQUIRED_REG_EXP =
  /^.*account \w+ balance \d+ below min (\d+).*$/;
const TARGET_ADDRESS_TOKEN_NOT_ACTIVE_REG_EXP =
  /^.*asset (\d+) missing from \w+$/;

export default class Vault extends VaultBase {
  keyringMap = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringWatching,
  };

  settings = settings;

  private getAlgod = memoizee(
    (token, serverURL, port) => new sdk.Algodv2(token, serverURL, port),
    {
      primitive: true,
      maxAge: getTimeDurationMs({ minute: 3 }),
      max: 3,
    },
  );

  private getIndexer = memoizee(
    async () => {
      const { isTestnet = true } = await this.engine.getNetwork(this.networkId);
      const network = isTestnet ? 'testnet' : 'mainnet';
      return new sdk.Indexer(
        '',
        `https://algosigner.api.purestake.io/${network}/indexer`,
        443,
      );
    },
    {
      maxAge: getTimeDurationMs({ minute: 3 }),
      promise: true,
      max: 1,
    },
  );

  private async getClient() {
    const { rpcURL } = await this.engine.getNetwork(this.networkId);
    // TODO: token support
    return this.getAlgod('', rpcURL, 443);
  }

  private getSuggestedParams = memoizee(
    async () => {
      const client = await this.getClient();
      return client.getTransactionParams().do();
    },
    {
      promise: true,
      maxAge: getTimeDurationMs({ minute: 3 }),
    },
  );

  // Chain only methods

  override createClientFromURL(_url: string): BaseClient {
    // This isn't needed.
    throw new NotImplemented();
  }

  override async getClientEndpointStatus(
    url: string,
  ): Promise<{ responseTime: number; latestBlock: number }> {
    const algod = this.getAlgod('', url, 443); // TODO port
    const start = performance.now();
    const { 'last-round': latestBlock } = await algod.status().do();
    return { responseTime: Math.floor(performance.now() - start), latestBlock };
  }

  async fetchTokenInfos(
    tokenAddresses: string[],
  ): Promise<Array<PartialTokenInfo | undefined>> {
    const client = await this.getClient();
    return Promise.all(
      tokenAddresses.map(async (assetId) => {
        try {
          const {
            params: { decimals, name, 'unit-name': symbol },
          } = await client.getAssetByID(parseInt(assetId)).do();
          return { decimals, name, symbol };
        } catch {
          // pass
        }
      }),
    );
  }

  override validateAddress(address: string) {
    if (sdk.isValidAddress(address)) {
      return Promise.resolve(address);
    }
    return Promise.reject(new InvalidAddress());
  }

  override validateWatchingCredential(input: string) {
    return Promise.resolve(
      this.settings.watchingAccountEnabled && sdk.isValidAddress(input),
    );
  }

  override validateTokenAddress(address: string): Promise<string> {
    const assetId = new BigNumber(address);
    if (
      assetId.isFinite() &&
      assetId.gte(0) &&
      assetId.lt(ASSET_ID_END_BOUNDARY)
    ) {
      return Promise.resolve(address);
    }
    return Promise.reject(new InvalidTokenAddress());
  }

  override async getBalances(
    requests: { address: string; tokenAddress?: string | undefined }[],
  ): Promise<(BigNumber | undefined)[]> {
    const client = await this.getClient();

    const addresses = [...new Set(requests.map(({ address }) => address))];
    const accountBalances = (
      await Promise.all(
        addresses.map(async (address) => {
          try {
            return (await client
              .accountInformation(address)
              .do()) as IAccountInformation;
          } catch {
            // pass
          }
        }),
      )
    ).filter(Boolean);
    const balancesByAddress: Record<
      string,
      Record<string, BigNumber>
    > = Object.fromEntries(
      accountBalances.map(({ address, amount, assets }) => [
        address,
        Object.fromEntries(
          [['main', new BigNumber(amount)]].concat(
            assets.map(({ amount: assetAmount, 'asset-id': assetId }) => [
              assetId.toString(),
              new BigNumber(assetAmount),
            ]),
          ),
        ),
      ]),
    );

    return requests.map(({ address, tokenAddress: assetId }) => {
      if (typeof balancesByAddress[address] !== 'undefined') {
        // Got balance info of the address
        return (
          balancesByAddress[address][assetId || 'main'] ?? new BigNumber(0)
        );
      }
      // Error happened
      return undefined;
    });
  }

  override async getTransactionStatuses(
    txids: Array<string>,
  ): Promise<Array<TransactionStatus | undefined>> {
    const client = await this.getClient();
    const indexer = await this.getIndexer();

    return Promise.all(
      txids.map(async (txid) => {
        try {
          const { 'confirmed-round': confirmedRound, 'pool-error': poolError } =
            (await client
              .pendingTransactionInformation(txid)
              .do()) as IPendingTransactionInformation;
          if (poolError) {
            return TransactionStatus.CONFIRM_BUT_FAILED;
          }
          if (confirmedRound > 0) {
            return TransactionStatus.CONFIRM_AND_SUCCESS;
          }
          return TransactionStatus.PENDING;
        } catch (e) {
          const { status } = e as IClientError;
          if (status === 404) {
            // Not found in pool.
            try {
              await indexer.lookupTransactionByID(txid).do();
              return TransactionStatus.CONFIRM_AND_SUCCESS;
            } catch (eIndexer) {
              const { status: indexerRequestStatus } = eIndexer as IClientError;
              if (indexerRequestStatus === 404) {
                return TransactionStatus.NOT_FOUND;
              }
              throw eIndexer;
            }
          }
          throw e;
        }
      }),
    );
  }

  // Account related methods

  override async activateToken(
    tokenAddress: string,
    password: string,
  ): Promise<boolean> {
    const { address } = await this.getDbAccount();
    const client = await this.getClient();
    const { assets } = (await client
      .accountInformation(address)
      .do()) as IAccountInformation;

    for (const { 'asset-id': assetId } of assets) {
      if (assetId === parseInt(tokenAddress)) {
        return Promise.resolve(true);
      }
    }

    const encodedTx = await this.buildEncodedTxFromTransfer({
      from: address,
      to: address,
      amount: '0',
      token: tokenAddress,
    });
    const unsignedTx = await this.buildUnsignedTxFromEncodedTx(encodedTx);
    const tx = await this.signAndSendTransaction(
      unsignedTx,
      { password },
      false,
    );

    return !!tx.txid;
  }

  override attachFeeInfoToEncodedTx(params: {
    encodedTx: IEncodedTxAlgo;
    feeInfoValue: IFeeInfoUnit;
  }): Promise<IEncodedTxAlgo> {
    return Promise.resolve(params.encodedTx);
  }

  override async decodeTx(
    encodedTx: IEncodedTxAlgo,
    _payload?: any,
  ): Promise<IDecodedTx> {
    const dbAccount = (await this.getDbAccount()) as DBSimpleAccount;
    const nativeToken = await this.engine.getNativeTokenInfo(this.networkId);
    let action: IDecodedTxAction = { type: IDecodedTxActionType.UNKNOWN };

    const nativeTx = sdk.decodeObj(
      Buffer.from(encodedTx, 'base64'),
    ) as sdk.EncodedTransaction;
    const sender = sdk.encodeAddress(nativeTx.snd);

    if (nativeTx.type === sdk.TransactionType.pay) {
      const amount = nativeTx.amt!.toString();
      const to = sdk.encodeAddress(nativeTx.rcv!);
      action = {
        type: IDecodedTxActionType.NATIVE_TRANSFER,
        nativeTransfer: {
          tokenInfo: nativeToken,
          from: sender,
          to,
          amount: new BigNumber(amount)
            .shiftedBy(-nativeToken.decimals)
            .toFixed(),
          amountValue: amount.toString(),
          extraInfo: null,
        },
      };
    }

    if (nativeTx.type === sdk.TransactionType.axfer) {
      const to = sdk.encodeAddress(nativeTx.arcv!);
      const token = await this.engine.ensureTokenInDB(
        this.networkId,
        nativeTx.xaid!.toString(),
      );
      let amount = new BigNumber(nativeTx.aamt?.toString() ?? 0).toFixed();
      if (typeof token !== 'undefined') {
        // opt-in to an asset
        if (sender === to && amount === '0') {
          action = {
            type: IDecodedTxActionType.TOKEN_ACTIVATE,
            tokenActivate: {
              tokenAddress: token.tokenIdOnNetwork,
              logoURI: '',
              decimals: token.decimals,
              name: token.name,
              symbol: token.symbol,
              extraInfo: null,
            },
          };
        } else {
          const assetSender = nativeTx.asnd && sdk.encodeAddress(nativeTx.asnd);
          // opt-out of an asset
          if (nativeTx.aclose) {
            const [balance] = await this.getBalances([
              {
                address: dbAccount.address,
                tokenAddress: token.tokenIdOnNetwork,
              },
            ]);

            amount = new BigNumber(balance ?? 0).toFixed();
          }
          action = {
            type: IDecodedTxActionType.TOKEN_TRANSFER,
            tokenTransfer: {
              tokenInfo: token,
              from: assetSender ?? sender,
              to,
              amount: new BigNumber(amount)
                .shiftedBy(-token.decimals)
                .toFixed(),
              amountValue: amount,
              extraInfo: null,
            },
          };
        }
      }
    }

    return {
      txid: '',
      owner: dbAccount.address,
      signer: sender,
      nonce: 0,
      actions: [action],
      status: IDecodedTxStatus.Pending,
      networkId: this.networkId,
      accountId: this.accountId,
      totalFeeInNative: new BigNumber(nativeTx.fee!)
        .shiftedBy(-nativeToken.decimals)
        .toFixed(),
      extraInfo: null,
      encodedTx,
    };
  }

  override decodedTxToLegacy(
    _decodedTx: IDecodedTx,
  ): Promise<IDecodedTxLegacy> {
    return Promise.resolve({} as IDecodedTxLegacy);
  }

  override async buildEncodedTxFromTransfer(
    transferInfo: ITransferInfo,
  ): Promise<IEncodedTxAlgo> {
    const { from, to, amount, token: assetId } = transferInfo;

    const token = await this.engine.ensureTokenInDB(
      this.networkId,
      assetId || '',
    );

    if (!token) {
      throw new OneKeyInternalError(`Token not found: ${assetId || 'ALGO'}`);
    }

    const suggestedParams = await this.getSuggestedParams();
    if (assetId) {
      return encodeTransaction(
        sdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          amount: BigInt(
            new BigNumber(amount).shiftedBy(token.decimals).toFixed(),
          ),
          assetIndex: parseInt(assetId),
          from,
          to,
          suggestedParams,
        }),
      );
    }

    return encodeTransaction(
      sdk.makePaymentTxnWithSuggestedParamsFromObject({
        amount: BigInt(
          new BigNumber(amount).shiftedBy(token.decimals).toFixed(),
        ),
        from,
        to,
        suggestedParams,
      }),
    );
  }

  override buildEncodedTxFromApprove(
    _approveInfo: IApproveInfo,
  ): Promise<IEncodedTxAlgo> {
    throw new NotImplemented();
  }

  override updateEncodedTxTokenApprove(
    _encodedTx: IEncodedTxAlgo,
    _amount: string,
  ): Promise<IEncodedTxAlgo> {
    throw new NotImplemented();
  }

  override async getFrozenBalance() {
    const client = await this.getClient();
    const { decimals } = await this.engine.getNativeTokenInfo(this.networkId);
    const { address } = await this.getDbAccount();
    try {
      const { 'min-balance': minBalance = 0 } = (await client
        .accountInformation(address)
        .do()) as IAccountInformation;
      return {
        'main': new BigNumber(minBalance ?? 0).shiftedBy(-decimals).toNumber(),
      };
    } catch {
      return 0;
    }
  }

  override async updateEncodedTx(
    encodedTx: IEncodedTxAlgo,
    payload: any,
    options: IEncodedTxUpdateOptions,
  ): Promise<IEncodedTxAlgo> {
    const nativeTx = sdk.decodeObj(
      Buffer.from(encodedTx, 'base64'),
    ) as sdk.EncodedTransaction;
    if (
      options.type === IEncodedTxUpdateType.transfer &&
      nativeTx.type === sdk.TransactionType.pay
    ) {
      const { decimals } = await this.engine.getNativeTokenInfo(this.networkId);
      const { amount } = payload as IEncodedTxUpdatePayloadTransfer;

      return encodeTransaction(
        sdk.Transaction.from_obj_for_encoding({
          ...nativeTx,
          amt: BigInt(new BigNumber(amount).shiftedBy(decimals).toFixed()),
        }),
      );
    }
    return Promise.resolve(encodedTx);
  }

  override buildUnsignedTxFromEncodedTx(
    encodedTx: IEncodedTxAlgo,
  ): Promise<IUnsignedTxPro> {
    return Promise.resolve({
      inputs: [],
      outputs: [],
      payload: { encodedTx },
      encodedTx,
    });
  }

  override async fetchFeeInfo(encodedTx: IEncodedTxAlgo): Promise<IFeeInfo> {
    const network = await this.getNetwork();
    const { fee = 0 } = sdk.decodeObj(
      Buffer.from(encodedTx, 'base64'),
    ) as sdk.EncodedTransaction;

    return {
      nativeSymbol: network.symbol,
      nativeDecimals: network.decimals,
      feeSymbol: network.feeSymbol,
      feeDecimals: network.feeDecimals,

      limit: '0',
      // TODO: need to cover the case when flatFee is true.
      prices: ['0'],
      defaultPresetIndex: '0',

      tx: null,
      baseFeeValue: new BigNumber(fee.toString())
        .shiftedBy(-network.feeDecimals)
        .toFixed(),
    };
  }

  override async broadcastTransaction(signedTx: ISignedTx): Promise<ISignedTx> {
    debugLogger.engine.info('broadcastTransaction START:', {
      rawTx: signedTx.rawTx,
    });
    const client = await this.getClient();
    try {
      const { txId: txid } = await client
        .sendRawTransaction(Buffer.from(signedTx.rawTx, 'base64'))
        .do();
      debugLogger.engine.info('broadcastTransaction END:', {
        txid,
        rawTx: signedTx.rawTx,
      });
      return {
        ...signedTx,
        txid,
      };
    } catch (e) {
      // When alog transaction fails, only an error message is returned
      const { message } = e as Error;
      if (TARGET_ADDRESS_TOKEN_NOT_ACTIVE_REG_EXP.test(message)) {
        const assetId = message.match(
          TARGET_ADDRESS_TOKEN_NOT_ACTIVE_REG_EXP,
        )![1];
        const token = await this.engine.ensureTokenInDB(
          this.networkId,
          assetId.toString(),
        );
        return Promise.reject(
          new RecipientHasNotActived(token?.name || assetId),
        );
      }
      if (MINIMUM_BALANCE_REQUIRED_REG_EXP.test(message)) {
        const { name, decimals } = await this.engine.getNativeTokenInfo(
          this.networkId,
        );
        const minimumBalance = message.match(
          MINIMUM_BALANCE_REQUIRED_REG_EXP,
        )![1];
        return Promise.reject(
          new MimimumBalanceRequired(
            name,
            new BigNumber(minimumBalance).shiftedBy(-decimals).toFixed(),
          ),
        );
      }

      return Promise.reject(e);
    }
  }

  override async getExportedCredential(password: string): Promise<string> {
    const dbAccount = await this.getDbAccount();
    if (dbAccount.id.startsWith('hd-') || dbAccount.id.startsWith('imported')) {
      const keyring = this.keyring as KeyringSoftwareBase;
      const [encryptedPrivateKey] = Object.values(
        await keyring.getPrivateKeys(password),
      );
      return sdk.mnemonicFromSeed(decrypt(password, encryptedPrivateKey));
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

    const { address } = await this.getDbAccount();
    const nativeToken = await this.engine.getNativeTokenInfo(this.networkId);

    const indexer = await this.getIndexer();
    const { transactions } = (await indexer
      .lookupAccountTransactions(address)
      .limit(50)
      .do()) as IAccountTransactionsResp;

    const promises = transactions.map(async (transaction) => {
      const historyTxToMerge = localHistory.find(
        (item) => item.decodedTx.txid === transaction.id,
      );
      if (historyTxToMerge && historyTxToMerge.decodedTx.isFinal) {
        return Promise.resolve(null);
      }

      try {
        const decodedTx: IDecodedTx = {
          txid: transaction.id,
          owner: address,
          signer: transaction.sender,
          nonce: 0,
          actions: [{ type: IDecodedTxActionType.UNKNOWN }],
          status: IDecodedTxStatus.Confirmed,
          networkId: this.networkId,
          accountId: this.accountId,
          extraInfo: null,
          totalFeeInNative: new BigNumber(transaction.fee)
            .shiftedBy(-nativeToken.decimals)
            .toFixed(),
          updatedAt: transaction['round-time'] * 1000,
          createdAt:
            historyTxToMerge?.decodedTx.createdAt ??
            transaction['round-time'] * 1000,
          isFinal: true,
        };

        if (
          transaction['tx-type'] === sdk.TransactionType.pay &&
          typeof transaction['payment-transaction'] !== 'undefined'
        ) {
          const { receiver: to, amount } = transaction['payment-transaction'];
          let direction = IDecodedTxDirection.IN;
          if (transaction.sender === address) {
            direction =
              to === address
                ? IDecodedTxDirection.SELF
                : IDecodedTxDirection.OUT;
          }
          decodedTx.actions[0] = {
            type: IDecodedTxActionType.NATIVE_TRANSFER,
            direction,
            nativeTransfer: {
              tokenInfo: nativeToken,
              from: transaction.sender,
              to,
              amount: new BigNumber(amount)
                .shiftedBy(-nativeToken.decimals)
                .toFixed(),
              amountValue: amount.toString(),
              extraInfo: null,
            },
          };
        } else if (
          transaction['tx-type'] === sdk.TransactionType.axfer &&
          typeof transaction['asset-transfer-transaction'] !== 'undefined'
        ) {
          const {
            receiver: to,
            amount,
            // eslint-disable-next-line no-unused-vars,@typescript-eslint/no-unused-vars
            'close-to': closeTo,
            'close-amount': closeAmount,
            'asset-id': assetId,
          } = transaction['asset-transfer-transaction'];
          const token = await this.engine.ensureTokenInDB(
            this.networkId,
            assetId.toString(),
          );
          if (typeof token === 'undefined') {
            throw new OneKeyInternalError('Failed to get token info.');
          }

          if (
            transaction.sender === address &&
            to === address &&
            amount === 0
          ) {
            // Special case of token activation;
            decodedTx.actions[0] = {
              type: IDecodedTxActionType.TOKEN_ACTIVATE,
              tokenActivate: {
                tokenAddress: token.tokenIdOnNetwork,
                logoURI: '',
                decimals: token.decimals,
                name: token.name,
                symbol: token.symbol,

                extraInfo: null,
              },
            };
          } else {
            let direction = IDecodedTxDirection.IN;
            if (transaction.sender === address) {
              direction =
                to === address
                  ? IDecodedTxDirection.SELF
                  : IDecodedTxDirection.OUT;
            }

            decodedTx.actions[0] = {
              type: IDecodedTxActionType.TOKEN_TRANSFER,
              direction,
              tokenTransfer: {
                tokenInfo: token,
                from: transaction.sender,
                to,
                amount: new BigNumber(closeAmount > 0 ? closeAmount : amount)
                  .shiftedBy(-token.decimals)
                  .toFixed(),
                amountValue: amount.toString(),
                extraInfo: null,
              },
            };
          }
        }

        return await this.buildHistoryTx({
          decodedTx,
          historyTxToMerge,
        });
      } catch (e) {
        debugLogger.common.error(e);
      }
    });

    return (await Promise.all(promises)).filter(Boolean);
  }

  override getPrivateKeyByCredential(credential: string) {
    return Buffer.from(sdk.seedFromMnemonic(credential));
  }
}
