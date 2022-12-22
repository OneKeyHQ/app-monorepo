/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { TransactionStatus } from '@onekeyfe/blockchain-libs/dist/types/provider';
import BigNumber from 'bignumber.js';
import memoizee from 'memoizee';

import { COINTYPE_ADA } from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import {
  InsufficientBalance,
  InvalidAddress,
  NotImplemented,
  OneKeyInternalError,
} from '../../../errors';
import { AccountType } from '../../../types/account';
import {
  IDecodedTxActionType,
  IDecodedTxDirection,
  IDecodedTxStatus,
} from '../../types';
import { VaultBase } from '../../VaultBase';

import { validBootstrapAddress, validShelleyAddress } from './helper/addresses';
import {
  decodePrivateKeyByXprv,
  generateExportedCredential,
} from './helper/bip32';
import { getChangeAddress } from './helper/cardanoUtils';
import Client from './helper/client';
import { getCardanoApi } from './helper/sdk';
import { transformToOneKeyInputs } from './helper/transformations';
import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import settings from './settings';

import type { ExportedSeedCredential } from '../../../dbs/base';
import type { Account, DBUTXOAccount } from '../../../types/account';
import type { Token } from '../../../types/token';
import type {
  IApproveInfo,
  IDecodedTx,
  IDecodedTxAction,
  IDecodedTxActionNativeTransfer,
  IDecodedTxActionTokenTransfer,
  IDecodedTxLegacy,
  IEncodedTx,
  IFeeInfo,
  IFeeInfoUnit,
  IHistoryTx,
  ISignedTxPro,
  ITransferInfo,
  IUnsignedTxPro,
} from '../../types';
import type {
  IAdaAmount,
  IAdaHistory,
  IEncodeOutput,
  IEncodedTxADA,
} from './types';
import type { PartialTokenInfo } from '@onekeyfe/blockchain-libs/dist/types/provider';

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

  async getClient() {
    const { rpcURL } = await this.engine.getNetwork(this.networkId);
    return this.getClientCache(rpcURL);
  }

  private getClientCache = memoizee((rpcUrl: string) => new Client(rpcUrl), {
    maxAge: 60 * 1000 * 3,
  });

  override async getOutputAccount(): Promise<Account & { addresses: string }> {
    const dbAccount = (await this.getDbAccount()) as DBUTXOAccount;
    return {
      id: dbAccount.id,
      name: dbAccount.name,
      type: dbAccount.type,
      path: dbAccount.path,
      coinType: dbAccount.coinType,
      tokens: [],
      address: dbAccount.address,
      addresses: JSON.stringify(dbAccount.addresses),
    };
  }

  override getFetchBalanceAddress(
    account:
      | DBUTXOAccount
      | (Account & { addresses: string | Record<string, string> }),
  ) {
    if (
      account.type === AccountType.UTXO &&
      typeof account.addresses === 'object'
    ) {
      return Promise.resolve(account.addresses['2/0']);
    }
    if (typeof account.addresses === 'string') {
      try {
        const addresses: DBUTXOAccount['addresses'] = JSON.parse(
          account.addresses,
        );
        return Promise.resolve(addresses['2/0']);
      } catch {
        return Promise.resolve(account.address);
      }
    }
    return Promise.resolve(account.address);
  }

  override async getClientEndpointStatus(): Promise<{
    responseTime: number;
    latestBlock: number;
  }> {
    const start = performance.now();
    const client = await this.getClient();
    const result = await client.latestBlock();
    return {
      responseTime: Math.floor(performance.now() - start),
      latestBlock: result.height,
    };
  }

  override async checkAccountExistence(
    accountIdOnNetwork: string,
  ): Promise<boolean> {
    let accountIsPresent = false;
    try {
      const client = await this.getClient();
      const { tx_count: txs } = await client.getAddressDetails(
        accountIdOnNetwork,
      );
      accountIsPresent = txs > 0;
    } catch (e) {
      console.error(e);
    }
    return Promise.resolve(accountIsPresent);
  }

  override async validateAddress(address: string): Promise<string> {
    if (validShelleyAddress(address) || validBootstrapAddress(address)) {
      return Promise.resolve(address);
    }
    return Promise.reject(new InvalidAddress());
  }

  override validateWatchingCredential(input: string): Promise<boolean> {
    let ret = false;
    try {
      if (this.settings.watchingAccountEnabled && validShelleyAddress(input)) {
        ret = true;
      }
    } catch {
      // ignore
    }
    return Promise.resolve(ret);
  }

  override validateImportedCredential(input: string): Promise<boolean> {
    return Promise.resolve(
      this.settings.importedAccountEnabled &&
        /^xprv/.test(input) &&
        input.length >= 165,
    );
  }

  override async getExportedCredential(password: string): Promise<string> {
    const { entropy } = (await this.engine.dbApi.getCredential(
      this.walletId,
      password,
    )) as ExportedSeedCredential;

    const dbAccount = (await this.getDbAccount()) as DBUTXOAccount;
    return generateExportedCredential(password, entropy, dbAccount.path);
  }

  override attachFeeInfoToEncodedTx(params: {
    encodedTx: IEncodedTxADA;
    feeInfoValue: IFeeInfoUnit;
  }): Promise<IEncodedTxADA> {
    return Promise.resolve(params.encodedTx);
  }

  decodedTxToLegacy(decodedTx: IDecodedTx): Promise<IDecodedTxLegacy> {
    return Promise.resolve({} as IDecodedTxLegacy);
  }

  override async decodeTx(
    encodedTx: IEncodedTxADA,
    payload?: any,
  ): Promise<IDecodedTx> {
    const { inputs, outputs, transferInfo } = encodedTx;
    const network = await this.engine.getNetwork(this.networkId);
    const dbAccount = (await this.getDbAccount()) as DBUTXOAccount;
    const client = await this.getClient();
    const nativeToken = await this.engine.getNativeTokenInfo(this.networkId);

    const actions: IDecodedTxAction[] = [];

    let token: Token = await this.engine.getNativeTokenInfo(this.networkId);
    const isTokenTransfer = !!transferInfo?.token?.length;
    if (isTokenTransfer) {
      token = (await this.engine.ensureTokenInDB(
        this.networkId,
        transferInfo.token ?? '',
      )) as Token;
      if (!token) {
        token = await client.getAssetDetail(
          transferInfo.token ?? '',
          this.networkId,
        );
      }

      // build tokenTransfer
      const amountMap = this.getOutputAmount(
        outputs,
        token.decimals ?? network.decimals,
        transferInfo.token,
      );
      const tokenTransfer: IDecodedTxActionTokenTransfer = {
        tokenInfo: token,
        from: dbAccount.address,
        to: transferInfo.to,
        amount: amountMap.amount,
        amountValue: amountMap.amountValue,
        extraInfo: null,
      };
      actions.push({
        type: IDecodedTxActionType.TOKEN_TRANSFER,
        direction:
          outputs[0].address === dbAccount.address
            ? IDecodedTxDirection.OUT
            : IDecodedTxDirection.SELF,
        tokenTransfer,
      });
    }

    // build nativeTransfer
    const nativeAmountMap = this.getOutputAmount(outputs, network.decimals);
    const transferAction: IDecodedTxActionNativeTransfer = {
      tokenInfo: nativeToken,
      utxoFrom: inputs.map((input) => {
        const { balance, balanceValue } = this.getInputOrOutputBalance(
          input.amount,
          network.decimals,
        );
        return {
          address: input.address,
          balance,
          balanceValue,
          symbol: network.symbol,
          isMine: true,
        };
      }),
      utxoTo: outputs.map((output) => ({
        address: output.address,
        balance: new BigNumber(output.amount)
          .shiftedBy(network.decimals)
          .toFixed(),
        balanceValue: output.amount,
        symbol: network.symbol,
        isMine: output.address === dbAccount.address,
      })),
      from: dbAccount.address,
      to: transferInfo.to,
      amount: nativeAmountMap.amount,
      amountValue: nativeAmountMap.amountValue,
      extraInfo: null,
    };

    actions.push({
      type: IDecodedTxActionType.NATIVE_TRANSFER,
      direction:
        outputs[0].address === dbAccount.address
          ? IDecodedTxDirection.OUT
          : IDecodedTxDirection.SELF,
      nativeTransfer: transferAction,
    });

    return {
      txid: '',
      owner: dbAccount.address,
      signer: dbAccount.address,
      nonce: 0,
      actions,
      status: IDecodedTxStatus.Pending,
      networkId: this.networkId,
      accountId: this.accountId,
      extraInfo: null,
      totalFeeInNative: encodedTx.totalFeeInNative,
    };
  }

  private getInputOrOutputBalance = (
    amounts: IAdaAmount[],
    decimals: number,
    asset = 'lovelace',
  ): { balance: string; balanceValue: string } => {
    const item = amounts.filter((amount) => amount.unit === asset);
    if (!item || item.length <= 0) {
      return { balance: '0', balanceValue: '0' };
    }
    const amount = item[0]?.quantity ?? '0';
    return {
      balance: new BigNumber(amount).shiftedBy(-decimals).toFixed(),
      balanceValue: amount,
    };
  };

  private getOutputAmount = (
    outputs: IEncodeOutput[],
    decimals: number,
    asset = 'lovelace',
  ) => {
    const realOutput = outputs.find((output) => !output.isChange);
    if (!realOutput) {
      return {
        amount: new BigNumber(0).shiftedBy(-decimals).toFixed(),
        amountValue: '0',
      };
    }
    if (asset === 'lovelace') {
      return {
        amount: new BigNumber(realOutput.amount).shiftedBy(-decimals).toFixed(),
        amountValue: realOutput.amount,
      };
    }
    const assetAmount = realOutput.assets.find((token) => token.unit === asset);
    return {
      amount: new BigNumber(assetAmount?.quantity ?? 0)
        .shiftedBy(-decimals)
        .toFixed(),
      amountValue: assetAmount?.quantity ?? '0',
    };
  };

  override async buildEncodedTxFromTransfer(
    transferInfo: ITransferInfo,
  ): Promise<IEncodedTxADA> {
    const { to, amount, token: tokenAddress } = transferInfo;
    const dbAccount = (await this.getDbAccount()) as DBUTXOAccount;
    const { decimals, feeDecimals } = await this.engine.getNetwork(
      this.networkId,
    );
    const token = await this.engine.ensureTokenInDB(
      this.networkId,
      tokenAddress ?? '',
    );
    if (!token) {
      throw new OneKeyInternalError(
        `Token not found: ${tokenAddress || 'main'}`,
      );
    }

    const client = await this.getClient();
    const utxos = await client.getUTXOs(dbAccount);

    const amountBN = new BigNumber(amount).shiftedBy(decimals);
    const output = tokenAddress
      ? {
          address: to,
          amount: undefined,
          assets: [
            {
              quantity: amountBN.toFixed(),
              unit: tokenAddress,
            },
          ],
        }
      : {
          address: to,
          amount: amountBN.toFixed(),
          assets: [],
        };
    const CardanoApi = await getCardanoApi();
    let txPlan: Awaited<ReturnType<typeof CardanoApi.composeTxPlan>>;
    try {
      txPlan = await CardanoApi.composeTxPlan(
        transferInfo,
        dbAccount.xpub,
        utxos,
        dbAccount.address,
        [output as any],
      );
    } catch (e: any) {
      const utxoVauleTooSmall = 'UTXO_VALUE_TOO_SMALL';
      if (e.code === utxoVauleTooSmall || e.message === utxoVauleTooSmall) {
        throw new InsufficientBalance();
      }
      throw e;
    }

    const changeAddress = getChangeAddress(dbAccount);

    // @ts-expect-error
    const { fee, inputs, outputs, totalSpent, tx } = txPlan;
    const totalFeeInNative = new BigNumber(fee)
      .shiftedBy(-1 * feeDecimals)
      .toFixed();

    return {
      inputs,
      outputs,
      fee,
      totalSpent,
      totalFeeInNative,
      transferInfo,
      tx,
      changeAddress,
      signOnly: false,
    };
  }

  buildEncodedTxFromApprove(approveInfo: IApproveInfo): Promise<any> {
    throw new NotImplemented();
  }

  updateEncodedTxTokenApprove(
    encodedTx: IEncodedTx,
    amount: string,
  ): Promise<IEncodedTx> {
    throw new NotImplemented();
  }

  updateEncodedTx(encodedTx: IEncodedTx): Promise<IEncodedTx> {
    return Promise.resolve(encodedTx);
  }

  override async buildUnsignedTxFromEncodedTx(
    encodedTx: IEncodedTxADA,
  ): Promise<IUnsignedTxPro> {
    const { inputs, outputs } = encodedTx;

    const ret = {
      inputs,
      outputs,
      payload: {},
      encodedTx,
    };

    return Promise.resolve(ret as unknown as IUnsignedTxPro);
  }

  override async fetchOnChainHistory(options: {
    tokenIdOnNetwork?: string | undefined;
    localHistory?: IHistoryTx[] | undefined;
  }): Promise<IHistoryTx[]> {
    const { localHistory = [] } = options;

    const client = await this.getClient();
    const dbAccount = (await this.getDbAccount()) as DBUTXOAccount;
    const stakeAddress = await this.getStakeAddress(dbAccount.address);
    const { decimals, symbol } = await this.engine.getNetwork(this.networkId);
    const nativeToken = await this.engine.getNativeTokenInfo(this.networkId);
    let txs: IAdaHistory[] = [];

    try {
      txs = (await client.getHistory(stakeAddress, dbAccount.address)) ?? [];
    } catch (e) {
      console.error(e);
    }

    const promises = txs.map(async (tx) => {
      try {
        const historyTxToMerge = localHistory.find(
          (item) => item.decodedTx.txid === tx.tx_hash,
        );
        if (historyTxToMerge && historyTxToMerge.decodedTx.isFinal) {
          // No need to update.
          return null;
        }
        const {
          fee,
          actions,
          block_hash: blockHash,
          tx_timestamp: txTimestamp,
        } = tx.tx;

        const promiseActions = actions.map(async (action) => {
          const { from, to, amount, type, direction } = action;
          if (action.type === 'NATIVE_TRANSFER') {
            return {
              type: IDecodedTxActionType.NATIVE_TRANSFER,
              direction,
              nativeTransfer: {
                tokenInfo: nativeToken,
                utxoFrom: action.utxoFrom,
                utxoTo: action.utxoTo,
                from,
                to,
                amount,
                amountValue: action.amountValue,
                extraInfo: null,
              } as IDecodedTxActionNativeTransfer,
            };
          }
          if (action.type === 'TOKEN_TRANSFER') {
            const token = await this.engine.ensureTokenInDB(
              this.networkId,
              action.token.tokenIdOnNetwork,
            );
            return {
              type: IDecodedTxActionType.TOKEN_TRANSFER,
              direction,
              tokenTransfer: {
                tokenInfo: (token ?? action.token) as unknown as Token,
                from,
                to,
                amount: new BigNumber(action.amount)
                  .shiftedBy(-(token?.decimals ?? decimals))
                  .toFixed(),
                amountValue: action.amount,
                extraInfo: null,
              } as IDecodedTxActionTokenTransfer,
            };
          }
        });

        const decodeActions = (await Promise.all(
          promiseActions,
        )) as unknown as IDecodedTxAction[];

        const decodedTx: IDecodedTx = {
          txid: tx.tx_hash,
          owner: dbAccount.address,
          signer: dbAccount.address,
          nonce: 0,
          actions: decodeActions,
          status: blockHash
            ? IDecodedTxStatus.Confirmed
            : IDecodedTxStatus.Pending,
          networkId: this.networkId,
          accountId: this.accountId,
          extraInfo: null,
          totalFeeInNative: new BigNumber(fee).shiftedBy(-decimals).toFixed(),
        };
        decodedTx.updatedAt =
          typeof txTimestamp !== 'undefined' ? txTimestamp * 1000 : Date.now();
        decodedTx.createdAt =
          historyTxToMerge?.decodedTx.createdAt ?? decodedTx.updatedAt;
        decodedTx.isFinal = decodedTx.status === IDecodedTxStatus.Confirmed;
        return await this.buildHistoryTx({
          decodedTx,
          historyTxToMerge,
        });
      } catch (e) {
        console.error(e);
        return Promise.resolve(null);
      }
    });
    return (await Promise.all(promises)).filter(Boolean);
  }

  override async broadcastTransaction(
    signedTx: ISignedTxPro,
  ): Promise<ISignedTxPro> {
    debugLogger.engine.info('broadcastTransaction START:', {
      rawTx: signedTx.rawTx,
    });
    const client = await this.getClient();
    try {
      await client.submitTx(signedTx.rawTx);
    } catch (err) {
      debugLogger.sendTx.info('broadcastTransaction ERROR:', err);
      throw err;
    }

    debugLogger.engine.info('broadcastTransaction END:', {
      txid: signedTx.txid,
      rawTx: signedTx.rawTx,
    });

    return {
      ...signedTx,
      encodedTx: signedTx.encodedTx,
    };
  }

  override async fetchFeeInfo(encodedTx: IEncodedTxADA): Promise<IFeeInfo> {
    const network = await this.engine.getNetwork(this.networkId);
    return {
      customDisabled: true,
      limit: encodedTx.totalFeeInNative,
      prices: ['1'],
      defaultPresetIndex: '0',
      feeSymbol: network.symbol,
      feeDecimals: network.feeDecimals,
      nativeSymbol: network.symbol,
      nativeDecimals: network.decimals,
      tx: null, // Must be null if network not support feeInTx
    };
  }

  override async getTransactionStatuses(
    txids: string[],
  ): Promise<(TransactionStatus | undefined)[]> {
    const client = await this.getClient();
    return Promise.all(
      txids.map(async (txid) => {
        try {
          const response = await client.getRawTransaction(txid);
          if (response.index || response.block_height) {
            return TransactionStatus.CONFIRM_AND_SUCCESS;
          }
          return TransactionStatus.PENDING;
        } catch (e) {
          console.error(e);
          return TransactionStatus.PENDING;
        }
      }),
    );
  }

  override async getBalances(
    requests: { address: string; tokenAddress?: string | undefined }[],
  ): Promise<(BigNumber | undefined)[]> {
    const client = await this.getClient();
    // batch recover account
    if (requests.every((request) => request.address.startsWith('stake'))) {
      const results = await Promise.all(
        requests.map(async (request) => {
          try {
            return await client.getBalance(request.address);
          } catch {
            return new BigNumber(0);
          }
        }),
      );
      return results;
    }

    const stakeAddress = await this.getStakeAddress(requests[0]?.address);
    const promises: (Promise<BigNumber> | Promise<IAdaAmount[]>)[] = [
      client.getBalance(stakeAddress),
    ];
    if (requests.some((v) => v.tokenAddress)) {
      promises.push(client.getAssetsBalances(stakeAddress));
    }
    try {
      const [balance, ...tokenBalance] = await Promise.all(promises);
      const results = requests.map(({ address, tokenAddress }) => {
        if (!tokenAddress) {
          return balance as BigNumber;
        }
        if (Array.isArray(tokenBalance) && tokenBalance.length) {
          const quantity =
            (tokenBalance[0] as IAdaAmount[]).find(
              (item) => item.unit === tokenAddress,
            )?.quantity ?? 0;
          return new BigNumber(quantity);
        }
        return new BigNumber(0);
      });
      return results;
    } catch {
      return requests.map(() => new BigNumber(0));
    }
  }

  override async validateTokenAddress(address: string): Promise<string> {
    const client = await this.getClient();
    try {
      const res = await client.getAssetDetail(address, this.networkId);
      return res.address ?? res.tokenIdOnNetwork;
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  override async fetchTokenInfos(
    tokenAddresses: string[],
  ): Promise<(PartialTokenInfo | undefined)[]> {
    const client = await this.getClient();
    return Promise.all(
      tokenAddresses.map(async (tokenAddress) => {
        const asset = await client.getAssetDetail(tokenAddress, this.networkId);
        return {
          decimals: asset.decimals,
          name: asset.name,
          symbol: asset.symbol,
        };
      }),
    );
  }

  override getPrivateKeyByCredential(credential: string) {
    return decodePrivateKeyByXprv(credential);
  }

  private getStakeAddress = memoizee(
    async (address: string) => {
      if (validShelleyAddress(address) && address.startsWith('stake')) {
        return address;
      }
      const account = (await this.engine.dbApi.getAccountByAddress({
        address,
        coinType: COINTYPE_ADA,
      })) as DBUTXOAccount;
      return account.addresses['2/0'];
    },
    {
      maxAge: 1000 * 60 * 30,
      promise: true,
    },
  );

  // Dapp Function

  async getBalanceForDapp(address: string) {
    const [balance] = await this.getBalances([{ address }]);
    const CardanoApi = await getCardanoApi();
    return CardanoApi.dAppUtils.getBalance(balance ?? new BigNumber(0));
  }

  async getUtxosForDapp(amount?: string) {
    const dbAccount = (await this.getDbAccount()) as DBUTXOAccount;
    const client = await this.getClient();
    const utxos = await client.getUTXOs(dbAccount);
    const CardanoApi = await getCardanoApi();
    return CardanoApi.dAppUtils.getUtxos(dbAccount.address, utxos, amount);
  }

  async getAccountAddressForDapp() {
    const dbAccount = (await this.getDbAccount()) as DBUTXOAccount;
    const CardanoApi = await getCardanoApi();
    return CardanoApi.dAppUtils.getAddresses([dbAccount.address]);
  }

  async getStakeAddressForDapp() {
    const dbAccount = (await this.getDbAccount()) as DBUTXOAccount;
    const stakeAddress = await this.getStakeAddress(dbAccount.address);
    const CardanoApi = await getCardanoApi();
    return CardanoApi.dAppUtils.getAddresses([stakeAddress]);
  }

  async buildTxCborToEncodeTx(txHex: string): Promise<IEncodedTxADA> {
    const dbAccount = (await this.getDbAccount()) as DBUTXOAccount;
    const changeAddress = getChangeAddress(dbAccount);
    const client = await this.getClient();
    const stakeAddress = await this.getStakeAddress(dbAccount.address);
    const addresses = await client.getAssociatedAddresses(stakeAddress);
    const utxos = await client.getUTXOs(dbAccount);
    const CardanoApi = await getCardanoApi();
    const encodeTx = await CardanoApi.dAppUtils.convertCborTxToEncodeTx(
      txHex,
      utxos,
      addresses,
    );
    return {
      ...encodeTx,
      changeAddress,
    };
  }
}
