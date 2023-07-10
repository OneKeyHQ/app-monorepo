/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */

import BigNumber from 'bignumber.js';
import bs58check from 'bs58check';
import { isNil } from 'lodash';

import type { BaseClient } from '@onekeyhq/engine/src/client/BaseClient';
import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import { decrypt } from '@onekeyhq/engine/src/secret/encryptors/aes256';
import type {
  FeePricePerUnit,
  TransactionStatus,
} from '@onekeyhq/engine/src/types/provider';
import type {
  IBlockBookTransaction,
  IBtcUTXO,
  ICoinSelectUTXO,
  ICoinSelectUTXOLite,
  ICollectUTXOsOptions,
  IEncodedTxBtc,
  PartialTokenInfo,
  TxInput,
} from '@onekeyhq/engine/src/vaults/utils/btcForkChain/types';
import { appSelector } from '@onekeyhq/kit/src/store';
import type { SendConfirmPayloadInfo } from '@onekeyhq/kit/src/views/Send/types';
import {
  COINTYPE_BTC,
  IMPL_BTC,
} from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';

import {
  getUtxoId,
  getUtxoUniqueKey,
} from '../../../dbs/simple/entity/SimpleDbEntityUtxoAccounts';
import {
  InsufficientBalance,
  InvalidAddress,
  NotImplemented,
  OneKeyInternalError,
  PreviousAccountIsEmpty,
} from '../../../errors';
import {
  getDefaultPurpose,
  getLastAccountId,
} from '../../../managers/derivation';
import { getAccountNameInfoByTemplate } from '../../../managers/impl';
import { getNFTTransactionHistory } from '../../../managers/nft';
import {
  type BTCTransactionsModel,
  NFTAssetType,
  type NFTBTCAssetModel,
  type NFTListItems,
} from '../../../types/nft';
import { INSCRIPTION_PADDING_SATS_VALUES } from '../../impl/btc/inscribe/consts';
import { EVMDecodedTxType } from '../../impl/evm/decoder/types';
import {
  IDecodedTxActionType,
  IDecodedTxDirection,
  IDecodedTxStatus,
  IEncodedTxUpdateType,
} from '../../types';
import { VaultBase } from '../../VaultBase';

import { Provider } from './provider';
import { BlockBook, getRpcUrlFromChainInfo } from './provider/blockbook';
import {
  coinSelect,
  coinSelectForOrdinal,
  getAccountDefaultByPurpose,
  getBIP44Path,
} from './utils';

import type { ExportedPrivateKeyCredential } from '../../../dbs/base';
import type { TxMapType } from '../../../managers/nft';
import type {
  Account,
  BtcForkChainUsedAccount,
  DBUTXOAccount,
} from '../../../types/account';
import type { NFTAssetMeta } from '../../../types/nft';
import type {
  CoinControlItem,
  ICoinControlListItem,
} from '../../../types/utxoAccounts';
import type { KeyringBaseMock } from '../../keyring/KeyringBase';
import type { KeyringHdBase } from '../../keyring/KeyringHdBase';
import type {
  IApproveInfo,
  IDecodedTx,
  IDecodedTxAction,
  IDecodedTxLegacy,
  IEncodedTx,
  IEncodedTxUpdateOptions,
  IFeeInfo,
  IFeeInfoUnit,
  IHistoryTx,
  INFTInfo,
  ISignedTxPro,
  ITransferInfo,
  IUnsignedTxPro,
  IVaultSettings,
} from '../../types';
import type { IKeyringMapKey } from '../../VaultBase';
import type { ICoinSelectAlgorithm } from './utils';

export default class VaultBtcFork extends VaultBase {
  keyringMap = {} as Record<IKeyringMapKey, typeof KeyringBaseMock>;

  settings = {} as IVaultSettings;

  providerClass = Provider;

  private provider?: Provider;

  getDefaultPurpose() {
    return getDefaultPurpose(IMPL_BTC);
  }

  getCoinName() {
    return 'BTC';
  }

  getCoinType() {
    return COINTYPE_BTC;
  }

  getXprvReg() {
    return /^[xyz]prv/;
  }

  getXpubReg() {
    return /^[xyz]pub/;
  }

  getDefaultBlockNums() {
    return [5, 2, 1];
  }

  getDefaultBlockTime() {
    return 600;
  }

  getAccountXpub(account: DBUTXOAccount) {
    return account.xpub;
  }

  async getProvider() {
    const rpcURL = await this.getRpcUrl();
    let currentProviderRpcUrl = '';
    if (this.provider?.chainInfo) {
      currentProviderRpcUrl = getRpcUrlFromChainInfo(this.provider?.chainInfo);
    }
    if (!this.provider || currentProviderRpcUrl !== rpcURL) {
      const chainInfo =
        await this.engine.providerManager.getChainInfoByNetworkId(
          this.networkId,
        );
      const ProviderClass = this.providerClass;
      this.provider = new ProviderClass(chainInfo);
    }
    return this.provider;
  }

  override async getOutputAccount(): Promise<Account> {
    // The simplest case as default implementation.
    const dbAccount = await this.getDbAccount({ noCache: true });
    return {
      id: dbAccount.id,
      name: dbAccount.name,
      type: dbAccount.type,
      path: dbAccount.path,
      coinType: dbAccount.coinType,
      tokens: [],
      address: dbAccount.address,
      xpub: this.getAccountXpub(dbAccount as DBUTXOAccount),
      template: dbAccount.template,
      customAddresses: JSON.stringify(
        (dbAccount as DBUTXOAccount).customAddresses,
      ),
    };
  }

  override getFetchBalanceAddress(account: DBUTXOAccount): Promise<string> {
    return Promise.resolve(this.getAccountXpub(account));
  }

  override async validateAddress(address: string): Promise<string> {
    const provider = await this.getProvider();
    const { normalizedAddress, isValid } = provider.verifyAddress(address);
    if (!isValid || typeof normalizedAddress === 'undefined') {
      throw new InvalidAddress();
    }
    return Promise.resolve(normalizedAddress);
  }

  override async validateImportedCredential(input: string): Promise<boolean> {
    const xprvReg = this.getXprvReg();
    let ret = false;
    try {
      ret =
        this.settings.importedAccountEnabled &&
        xprvReg.test(input) &&
        (await this.getProvider()).isValidXprv(input);
    } catch {
      // pass
    }
    return Promise.resolve(ret);
  }

  override async validateWatchingCredential(input: string): Promise<boolean> {
    const xpubReg = this.getXpubReg();
    let ret = false;
    try {
      ret =
        this.settings.watchingAccountEnabled &&
        xpubReg.test(input) &&
        (await this.getProvider()).isValidXpub(input);
    } catch {
      // ignore
    }
    return Promise.resolve(ret);
  }

  override async validateCanCreateNextAccount(
    walletId: string,
    template: string,
  ): Promise<boolean> {
    const [wallet, network] = await Promise.all([
      this.engine.getWallet(walletId),
      this.engine.getNetwork(this.networkId),
    ]);
    const lastAccountId = getLastAccountId(wallet, network.impl, template);
    if (!lastAccountId) return true;

    const [lastAccount] = (await this.engine.dbApi.getAccounts([
      lastAccountId,
    ])) as DBUTXOAccount[];
    if (typeof lastAccount !== 'undefined') {
      const accountExisted = await this.checkAccountExistence(
        this.getAccountXpub(lastAccount),
      );
      if (!accountExisted) {
        const { label } = getAccountNameInfoByTemplate(network.impl, template);
        throw new PreviousAccountIsEmpty(label as string);
      }
    }

    return true;
  }

  override async checkAccountExistence(
    accountIdOnNetwork: string,
    useAddress?: boolean,
  ): Promise<boolean> {
    let accountIsPresent = false;
    let txCount = 0;
    try {
      const provider = await this.getProvider();
      if (useAddress) {
        const { txs } = (await provider.getAccountWithAddress({
          type: 'simple',
          address: accountIdOnNetwork,
        })) as {
          txs: number;
        };
        txCount = txs;
      } else {
        const { txs } = (await provider.getAccount({
          type: 'simple',
          xpub: accountIdOnNetwork,
        })) as {
          txs: number;
        };
        txCount = txs;
      }
      accountIsPresent = txCount > 0;
    } catch (e) {
      console.error(e);
    }
    return Promise.resolve(accountIsPresent);
  }

  override async getAccountBalance(tokenIds: Array<string>, withMain = true) {
    // No token support on BTC.
    const ret = tokenIds.map((id) => undefined);
    if (!withMain) {
      return ret;
    }
    const account = (await this.getDbAccount()) as DBUTXOAccount;
    const xpub = this.getAccountXpub(account);
    if (!xpub) {
      return [new BigNumber('0'), ...ret];
    }
    const [mainBalance] = await this.getBalances([{ address: xpub }]);
    return [mainBalance].concat(ret);
  }

  override async getBalances(
    requests: { address: string; tokenAddress?: string | undefined }[],
  ): Promise<(BigNumber | undefined)[]> {
    return (await this.getProvider()).getBalances(requests);
  }

  async getBalancesByAddress(
    requests: { address: string; tokenAddress?: string | undefined }[],
  ): Promise<(BigNumber | undefined)[]> {
    return (await this.getProvider()).getBalancesByAddress(requests);
  }

  async getExportedCredential(password: string): Promise<string> {
    const dbAccount = (await this.getDbAccount()) as DBUTXOAccount;

    if (dbAccount.id.startsWith('hd-')) {
      const purpose = parseInt(dbAccount.path.split('/')[1]);
      const { addressEncoding } = getAccountDefaultByPurpose(
        purpose,
        this.getCoinName(),
      );
      const { network } = await this.getProvider();
      const { private: xprvVersionBytes } =
        (network.segwitVersionBytes || {})[addressEncoding] || network.bip32;

      const keyring = this.keyring as KeyringHdBase;
      const [encryptedPrivateKey] = Object.values(
        await keyring.getPrivateKeys(password),
      );
      return bs58check.encode(
        bs58check
          .decode(dbAccount.xpub)
          .fill(
            Buffer.from(xprvVersionBytes.toString(16).padStart(8, '0'), 'hex'),
            0,
            4,
          )
          .fill(
            Buffer.concat([
              Buffer.from([0]),
              decrypt(password, encryptedPrivateKey),
            ]),
            45,
            78,
          ),
      );
    }

    if (dbAccount.id.startsWith('imported-')) {
      // Imported accounts, crendetial is already xprv
      const { privateKey } = (await this.engine.dbApi.getCredential(
        this.accountId,
        password,
      )) as ExportedPrivateKeyCredential;
      if (typeof privateKey === 'undefined') {
        throw new OneKeyInternalError('Unable to get credential.');
      }
      return bs58check.encode(decrypt(password, privateKey));
    }

    throw new OneKeyInternalError(
      'Only credential of HD or imported accounts can be exported',
    );
  }

  async attachFeeInfoToEncodedTx(params: {
    encodedTx: IEncodedTxBtc;
    feeInfoValue: IFeeInfoUnit;
  }): Promise<IEncodedTxBtc> {
    const network = await this.engine.getNetwork(this.networkId);
    const { encodedTx, feeInfoValue } = params;
    const feeRate = feeInfoValue.feeRate
      ? new BigNumber(feeInfoValue.feeRate)
          .shiftedBy(-network.feeDecimals)
          .toFixed()
      : feeInfoValue.price;

    if (typeof feeRate === 'string') {
      if (encodedTx.transferInfos) {
        return this.buildEncodedTxFromBatchTransfer({
          transferInfos: encodedTx.transferInfos,
          specifiedFeeRate: feeRate,
        });
      }
      return this.buildEncodedTxFromTransfer(encodedTx.transferInfo, feeRate);
    }
    return Promise.resolve(params.encodedTx);
  }

  decodedTxToLegacy(decodedTx: IDecodedTx): Promise<IDecodedTxLegacy> {
    const { type, nativeTransfer, inscriptionInfo } = decodedTx.actions[0];
    if (type === IDecodedTxActionType.NATIVE_TRANSFER && nativeTransfer) {
      return Promise.resolve({
        txType: EVMDecodedTxType.NATIVE_TRANSFER,
        symbol: 'UNKNOWN',
        amount: nativeTransfer.amount,
        value: nativeTransfer.amountValue,
        fromAddress: nativeTransfer.from,
        toAddress: nativeTransfer.to,
        data: '',
        totalFeeInNative: decodedTx.totalFeeInNative,
        total: BigNumber.sum
          .apply(
            null,
            (nativeTransfer.utxoFrom || []).map(
              ({ balanceValue }) => balanceValue,
            ),
          )
          .toFixed(),
      } as IDecodedTxLegacy);
    }
    return Promise.resolve({} as IDecodedTxLegacy);
  }

  async decodeTx(
    encodedTx: IEncodedTxBtc,
    payload?: SendConfirmPayloadInfo,
  ): Promise<IDecodedTx> {
    const { inputs, outputs, transferInfo } = encodedTx;
    const network = await this.engine.getNetwork(this.networkId);
    const dbAccount = (await this.getDbAccount()) as DBUTXOAccount;
    const token = await this.engine.getNativeTokenInfo(this.networkId);
    let nftInfo: INFTInfo | null = null;
    if (payload?.nftInfo) {
      nftInfo = payload?.nftInfo;
    }
    const ordUtxo = transferInfo.isNFT
      ? inputs.find((item) => Boolean(item.forceSelect))
      : undefined;

    const utxoFrom = inputs.map((input) => ({
      address: input.address,
      balance: new BigNumber(input.value)
        .shiftedBy(-network.decimals)
        .toFixed(),
      balanceValue: input.value,
      symbol: network.symbol,
      isMine: true,
    }));
    const utxoTo = outputs
      .filter((output) => !output.payload?.isCharge)
      .map((output) => ({
        address: output.address,
        balance: new BigNumber(output.value)
          .shiftedBy(-network.decimals)
          .toFixed(),
        balanceValue: output.value,
        symbol: network.symbol,
        isMine: output.address === dbAccount.address,
      }));

    let actions: IDecodedTxAction[] = [];
    if (ordUtxo && nftInfo) {
      actions = [
        {
          type: IDecodedTxActionType.NFT_TRANSFER_BTC,
          direction: IDecodedTxDirection.OUT,
          inscriptionInfo: {
            send: nftInfo.from,
            receive: nftInfo?.to,
            asset: nftInfo?.asset as NFTBTCAssetModel,
            extraInfo: null,
          },
        },
      ];
    } else {
      actions = utxoTo.map((utxo) => ({
        type: IDecodedTxActionType.NATIVE_TRANSFER,
        direction:
          outputs[0].address === dbAccount.address
            ? IDecodedTxDirection.OUT
            : IDecodedTxDirection.SELF,
        utxoFrom,
        utxoTo,
        nativeTransfer: {
          tokenInfo: token,
          from: dbAccount.address,
          to: utxo.address,
          amount: utxo.balance,
          amountValue: utxo.balanceValue,
          extraInfo: null,
        },
      }));
    }

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

  async buildEncodedTxFromTransfer(
    transferInfo: ITransferInfo,
    specifiedFeeRate?: string,
  ): Promise<IEncodedTxBtc> {
    if (!transferInfo.to) {
      throw new Error('Invalid transferInfo.to params');
    }
    return this.buildEncodedTxFromBatchTransfer({
      transferInfos: [transferInfo],
      specifiedFeeRate,
    });
  }

  override async buildEncodedTxFromBatchTransfer({
    transferInfos,
    specifiedFeeRate,
  }: {
    transferInfos: ITransferInfo[];
    specifiedFeeRate?: string;
  }): Promise<IEncodedTxBtc> {
    const transferInfo = transferInfos[0];
    const network = await this.engine.getNetwork(this.networkId);
    const dbAccount = (await this.getDbAccount()) as DBUTXOAccount;

    const {
      inputs,
      outputs,
      fee,
      inputsForCoinSelect,
      outputsForCoinSelect,
      feeRate,
    } = await this.buildTransferParamsWithCoinSelector({
      transferInfos,
      specifiedFeeRate,
    });

    if (!inputs || !outputs || isNil(fee)) {
      throw new InsufficientBalance('Failed to select UTXOs');
    }
    const totalFee = fee.toString();
    const totalFeeInNative = new BigNumber(totalFee)
      .shiftedBy(-1 * network.feeDecimals)
      .toFixed();
    return {
      inputs: inputs.map(({ txId, value, ...keep }) => ({
        address: '',
        path: '',
        ...keep,
        txid: txId,
        value: value.toString(),
      })),
      outputs: outputs.map(({ value, address }) => {
        // If there is no address, it should be set to the change address.
        const addressOrChangeAddress = address || dbAccount.address;
        if (!addressOrChangeAddress) {
          throw new Error(
            'buildEncodedTxFromBatchTransfer ERROR: Invalid change address',
          );
        }
        const valueText = value?.toString();
        if (!valueText || new BigNumber(valueText).lte(0)) {
          throw new Error(
            'buildEncodedTxFromBatchTransfer ERROR: Invalid value',
          );
        }
        return {
          address: addressOrChangeAddress,
          value: valueText,
          payload: address
            ? undefined
            : {
                isCharge: true,
                bip44Path: getBIP44Path(dbAccount, dbAccount.address),
              },
        };
      }),
      totalFee,
      totalFeeInNative,
      transferInfo,
      transferInfos,
      feeRate,
      inputsForCoinSelect,
      outputsForCoinSelect,
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

  async updateEncodedTx(
    encodedTx: IEncodedTxBtc,
    payload: { selectedUtxos?: string[] },
    options: IEncodedTxUpdateOptions,
  ): Promise<IEncodedTx> {
    if (
      options.type === IEncodedTxUpdateType.advancedSettings &&
      Array.isArray(payload.selectedUtxos) &&
      payload.selectedUtxos.length
    ) {
      const network = await this.engine.getNetwork(this.networkId);
      return this.buildEncodedTxFromTransfer(
        {
          ...encodedTx.transferInfo,
          selectedUtxos: payload.selectedUtxos,
        },
        new BigNumber(encodedTx.feeRate)
          .shiftedBy(-network.feeDecimals)
          .toFixed(),
      );
    }
    return Promise.resolve(encodedTx);
  }

  buildUnsignedTxFromEncodedTx(
    encodedTx: IEncodedTxBtc,
  ): Promise<IUnsignedTxPro> {
    const { inputs, outputs } = encodedTx;

    const inputsInUnsignedTx: TxInput[] = [];
    for (const input of inputs) {
      const value = new BigNumber(input.value);
      inputsInUnsignedTx.push({
        address: input.address,
        value,
        utxo: { txid: input.txid, vout: input.vout, value },
      });
    }
    const outputsInUnsignedTx = outputs.map(({ address, value, payload }) => ({
      address,
      value: new BigNumber(value),
      payload,
    }));

    const ret = {
      inputs: inputsInUnsignedTx,
      outputs: outputsInUnsignedTx,
      payload: {},
      encodedTx,
    };

    return Promise.resolve(ret);
  }

  async fetchFeeInfo(
    encodedTx: IEncodedTxBtc,
    _: boolean | undefined,
    specifiedFeeRate: string,
  ): Promise<IFeeInfo> {
    const network = await this.engine.getNetwork(this.networkId);
    const provider = await this.getProvider();
    const { feeLimit } = await provider.buildUnsignedTx({
      ...(await this.buildUnsignedTxFromEncodedTx(encodedTx)),
      feePricePerUnit: new BigNumber(1),
      encodedTx,
    });

    const feeRates = specifiedFeeRate
      ? [specifiedFeeRate]
      : await this.getFeeRate();
    // Prices are in sats/byte, convert it to BTC/byte for UI.
    const prices = feeRates.map((price) =>
      new BigNumber(price).shiftedBy(-network.feeDecimals).toFixed(),
    );
    const feeList = prices
      .map(
        (price) =>
          coinSelect({
            inputsForCoinSelect: encodedTx.inputsForCoinSelect,
            outputsForCoinSelect: encodedTx.outputsForCoinSelect,
            feeRate: new BigNumber(price)
              .shiftedBy(network.feeDecimals)
              .toFixed(),
          }).fee,
      )
      .filter(Boolean);

    return {
      isBtcForkChain: true,
      limit: (feeLimit ?? new BigNumber(0)).toFixed(), // bytes in BTC
      prices,
      feeList,
      waitingSeconds: await this.getTxWaitingSeconds(),
      defaultPresetIndex: '1',
      feeSymbol: 'BTC',
      feeDecimals: network.feeDecimals,
      nativeSymbol: network.symbol,
      nativeDecimals: network.decimals,
      tx: null, // Must be null if network not support feeInTx
    };
  }

  override async getTxWaitingSeconds(): Promise<Array<number>> {
    const blockNums = this.getDefaultBlockNums();
    return blockNums.map(
      (numOfBlocks) => numOfBlocks * this.getDefaultBlockTime(),
    );
  }

  override async getFeePricePerUnit(): Promise<FeePricePerUnit> {
    const feeRates = await this.getFeeRate();
    const prices = feeRates.map((price) => new BigNumber(price));

    return {
      normal: { price: prices[1] },
      others: [{ price: prices[0] }, { price: prices[2] }],
    };
  }

  override async broadcastTransaction(
    signedTx: ISignedTxPro,
  ): Promise<ISignedTxPro> {
    debugLogger.engine.info('broadcastTransaction START:', {
      rawTx: signedTx.rawTx,
    });
    const provider = await this.getProvider();
    const txid = await provider.broadcastTransaction(signedTx.rawTx);
    debugLogger.engine.info('broadcastTransaction END:', {
      txid,
      rawTx: signedTx.rawTx,
    });
    return {
      ...signedTx,
      txid,
    };
  }

  override async getTransactionStatuses(
    txids: string[],
  ): Promise<(TransactionStatus | undefined)[]> {
    return (await this.getProvider()).getTransactionStatuses(txids);
  }

  buildActionsFromBTCTransaction({
    transaction,
    address,
  }: {
    transaction: BTCTransactionsModel;
    address: string;
  }): IDecodedTxAction[] {
    let type: IDecodedTxActionType = IDecodedTxActionType.UNKNOWN;
    const { send, receive, event_type: eventType, asset } = transaction;
    if (!asset) {
      return [];
    }
    const defaultData = {
      send,
      receive,
      asset,
      extraInfo: null,
    };
    if (eventType === 'Transfer') {
      type = IDecodedTxActionType.NFT_TRANSFER_BTC;
    } else if (eventType === 'Mint') {
      type = IDecodedTxActionType.NFT_INSCRIPTION;
    }
    const inscriptionAction = {
      type,
      hidden: !(send === address || receive === address),
      direction: IDecodedTxDirection.IN,
      extraInfo: null,
      inscriptionInfo: defaultData,
    };

    return [inscriptionAction];
  }

  mergeNFTTransaction({
    nftTxs,
    nativeActions,
    address,
  }: {
    address: string;
    nftTxs: BTCTransactionsModel[];
    nativeActions: IDecodedTxAction[];
  }): IDecodedTxAction[] {
    const nftActions = nftTxs
      ?.map((transaction) =>
        this.buildActionsFromBTCTransaction({
          transaction,
          address,
        }),
      )
      .flat()
      .filter(Boolean);
    return nftActions?.length > 0 ? nftActions : nativeActions;
  }

  override async fetchOnChainHistory(options: {
    tokenIdOnNetwork?: string;
    localHistory?: IHistoryTx[];
  }): Promise<IHistoryTx[]> {
    const { localHistory = [], tokenIdOnNetwork } = options;

    const provider = await this.getProvider();
    const dbAccount = (await this.getDbAccount()) as DBUTXOAccount;
    const { decimals, symbol, impl } = await this.engine.getNetwork(
      this.networkId,
    );
    const token = await this.engine.getNativeTokenInfo(this.networkId);
    let txs: Array<IBlockBookTransaction> = [];
    try {
      txs =
        (
          (await provider.getHistory(
            {
              type: 'history',
              xpub: this.getAccountXpub(dbAccount),
            },
            impl,
            dbAccount.address,
            symbol,
            decimals,
          )) as { transactions: Array<IBlockBookTransaction> }
        ).transactions ?? [];
    } catch (e) {
      console.error(e);
    }

    let nftMap: TxMapType = {};
    try {
      nftMap = await getNFTTransactionHistory(
        dbAccount.address,
        this.networkId,
      );
    } catch (e) {
      console.error(e);
    }

    const promises = txs.map((tx) => {
      try {
        const historyTxToMerge = localHistory.find(
          (item) => item.decodedTx.txid === tx.txid,
        );
        if (historyTxToMerge && historyTxToMerge.decodedTx.isFinal) {
          // No need to update.
          return null;
        }

        const { direction, utxoFrom, utxoTo, from, to, amount, amountValue } =
          tx;

        const utxoToWithoutMine = utxoTo?.filter((utxo) => !utxo.isMine);
        const actions =
          utxoToWithoutMine && utxoToWithoutMine.length
            ? utxoToWithoutMine
                .filter((utxo) => !utxo.isMine)
                .map((utxo) => ({
                  type: IDecodedTxActionType.NATIVE_TRANSFER,
                  direction,
                  nativeTransfer: {
                    tokenInfo: token,
                    utxoFrom,
                    utxoTo,
                    from,
                    to: utxo.address,
                    amount: utxo.balance,
                    amountValue: utxo.balanceValue,
                    extraInfo: null,
                  },
                }))
            : [
                {
                  type: IDecodedTxActionType.NATIVE_TRANSFER,
                  direction,
                  nativeTransfer: {
                    tokenInfo: token,
                    utxoFrom,
                    utxoTo,
                    from,
                    // For out transaction, use first address as to.
                    // For in or self transaction, use first owned address as to.
                    to,
                    amount,
                    amountValue,
                    extraInfo: null,
                  },
                },
              ];

        const nftTxs = nftMap[tx.txid] as BTCTransactionsModel[];
        const mergeNFTActions = this.mergeNFTTransaction({
          nftTxs,
          nativeActions: actions,
          address: dbAccount.address,
        });

        const decodedTx: IDecodedTx = {
          txid: tx.txid,
          owner: dbAccount.address,
          signer: dbAccount.address,
          nonce: 0,
          actions: mergeNFTActions,
          status:
            (tx.confirmations ?? 0) > 0
              ? IDecodedTxStatus.Confirmed
              : IDecodedTxStatus.Pending,
          networkId: this.networkId,
          accountId: this.accountId,
          extraInfo: null,
          totalFeeInNative: new BigNumber(tx.fees)
            .shiftedBy(-decimals)
            .toFixed(),
        };
        decodedTx.updatedAt =
          typeof tx.blockTime !== 'undefined'
            ? tx.blockTime * 1000
            : Date.now();
        decodedTx.createdAt =
          historyTxToMerge?.decodedTx.createdAt ?? decodedTx.updatedAt;
        decodedTx.isFinal = decodedTx.status === IDecodedTxStatus.Confirmed;
        return this.buildHistoryTx({
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

  override async fixActionDirection({
    action,
    accountAddress,
  }: {
    action: IDecodedTxAction;
    accountAddress: string;
  }): Promise<IDecodedTxAction> {
    // Calculate only if the action has no direction
    if (
      action.type === IDecodedTxActionType.NATIVE_TRANSFER &&
      !action.direction
    ) {
      action.direction = await this.buildTxActionDirection({
        from: action.nativeTransfer?.from || '',
        to: action.nativeTransfer?.to || '',
        address: accountAddress,
      });
    }
    return action;
  }

  collectUTXOsInfo = memoizee(
    async (options: ICollectUTXOsOptions = {}) => {
      const provider = await this.getProvider();
      const dbAccount = (await this.getDbAccount()) as DBUTXOAccount;
      try {
        const utxosInfo = await provider.getUTXOs(
          this.getAccountXpub(dbAccount),
          options,
        );
        return utxosInfo;
      } catch (e) {
        console.error(e);
        throw new OneKeyInternalError('Failed to get UTXOs of the account.');
      }
    },
    {
      promise: true,
      max: 4,
      maxAge: 1000 * 30,
    },
  );

  private getFeeRate = memoizee(
    async () => {
      // getRpcClient
      const client = await (await this.getProvider()).blockbook;
      const blockNums = this.getDefaultBlockNums();
      try {
        const fees = await Promise.all(
          blockNums.map((blockNum) =>
            client
              .estimateFee(blockNum)
              .then((feeRate) => new BigNumber(feeRate).toFixed(0)),
          ),
        );
        // Replace the negative number in the processing fee with the nearest element in the array
        const negativeIndex = fees.findIndex((val) => new BigNumber(val).lt(0));
        if (negativeIndex >= 0) {
          let positiveIndex = negativeIndex;
          while (
            positiveIndex < fees.length - 1 &&
            new BigNumber(fees[positiveIndex]).lt(0)
          ) {
            positiveIndex += 1;
          }
          while (
            positiveIndex > 0 &&
            new BigNumber(fees[positiveIndex]).lt(0)
          ) {
            positiveIndex -= 1;
          }
          fees.splice(negativeIndex, 1, fees[positiveIndex]);
        }
        return fees.sort((a, b) =>
          new BigNumber(a).comparedTo(new BigNumber(b)),
        );
      } catch (e) {
        console.error(e);
        throw new OneKeyInternalError('Failed to get fee rates.');
      }
    },
    {
      promise: true,
      max: 1,
      maxAge: 1000 * 30,
    },
  );

  override createClientFromURL(url: string) {
    // TODO type mismatch
    return new BlockBook(url) as unknown as BaseClient;
  }

  fetchTokenInfos(
    tokenAddresses: string[],
  ): Promise<Array<PartialTokenInfo | undefined>> {
    throw new NotImplemented();
  }

  override async getPrivateKeyByCredential(credential: string) {
    // xpub format:
    const result = bs58check.decode(credential);

    // hex format:
    // const result = '';
    return Promise.resolve(result);
  }

  override async getAllUsedAddress(): Promise<BtcForkChainUsedAccount[]> {
    const account = (await this.getDbAccount()) as DBUTXOAccount;
    const xpub = this.getAccountXpub(account);
    if (!xpub) {
      return [];
    }
    const provider = await this.getProvider();
    const { tokens = [] } = (await provider.getAccount({
      type: 'usedAddress',
      xpub,
    })) as unknown as { tokens: BtcForkChainUsedAccount[] };

    return tokens
      .filter((usedAccount) => {
        const pathComponents = usedAccount.path.split('/');
        const isChange =
          Number.isSafeInteger(+pathComponents[4]) && +pathComponents[4] === 1;
        return usedAccount.transfers > 0 && !isChange;
      })
      .map((usedAccount) => ({
        ...usedAccount,
        displayTotalReceived: new BigNumber(usedAccount.totalReceived)
          .shiftedBy(-8)
          .toFixed(),
      }));
  }

  async getAccountInfo({
    details = 'txs',
    from,
    to,
    pageSize,
  }: {
    details: string;
    from?: number;
    to?: number;
    pageSize?: number;
  }) {
    const account = (await this.getDbAccount()) as DBUTXOAccount;
    const xpub = this.getAccountXpub(account);
    if (!xpub) {
      return [];
    }
    const provider = await this.getProvider();
    return provider.getAccount({
      type: 'accountInfo',
      xpub,
      details,
      from,
      to,
      pageSize,
    });
  }

  private async getFrozenUtxos(xpub: string, utxos: IBtcUTXO[]) {
    const useDustUtxo =
      appSelector((s) => s.settings.advancedSettings?.useDustUtxo) ?? true;

    let dustUtxos: CoinControlItem[] = [];
    if (!useDustUtxo) {
      const network = await this.getNetwork();
      const dust = new BigNumber(
        (this.settings.dust ?? this.settings.minTransferAmount) || 0,
      ).shiftedBy(network.decimals);
      dustUtxos = utxos
        .filter((utxo) => new BigNumber(utxo.value).isLessThanOrEqualTo(dust))
        .map((utxo) => ({
          ...utxo,
          id: getUtxoId(this.networkId, utxo),
          key: getUtxoUniqueKey(utxo),
        })) as unknown as CoinControlItem[];
    }
    const archivedUtxos = await simpleDb.utxoAccounts.getCoinControlList(
      this.networkId,
      xpub,
    );
    const frozenUtxos = archivedUtxos.filter((utxo) => utxo.frozen);
    return frozenUtxos.concat(dustUtxos);
  }

  private async buildTransferParamsWithCoinSelector({
    transferInfos,
    specifiedFeeRate,
  }: {
    transferInfos: ITransferInfo[];
    specifiedFeeRate?: string;
  }) {
    if (!transferInfos.length) {
      throw new Error(
        'buildTransferParamsWithCoinSelector ERROR: transferInfos is required',
      );
    }
    const isBatchTransfer = transferInfos.length > 1;
    const isNftTransfer = Boolean(
      transferInfos.find((item) => item.isNFT || item.nftInscription),
    );
    const forceSelectUtxos: ICoinSelectUTXOLite[] = [];
    if (isNftTransfer) {
      if (isBatchTransfer) {
        throw new Error('BTC nft transfer is not supported in batch transfer');
      }
      const { nftInscription } = transferInfos[0];
      if (!nftInscription) {
        throw new Error('nftInscription is required for nft transfer');
      }
      const { output, address } = nftInscription;
      const [txId, vout] = output.split(':');
      if (!txId || !vout || !address) {
        throw new Error('invalid nftInscription output');
      }
      const voutNum = parseInt(vout, 10);
      if (Number.isNaN(voutNum)) {
        throw new Error('invalid nftInscription output: vout');
      }
      forceSelectUtxos.push({
        txId,
        vout: voutNum,
        address,
      });
    }
    const network = await this.engine.getNetwork(this.networkId);
    const dbAccount = (await this.getDbAccount()) as DBUTXOAccount;
    let { utxos } = await this.collectUTXOsInfo(
      forceSelectUtxos.length
        ? {
            forceSelectUtxos,
          }
        : undefined,
    );

    // Select the slowest fee rate as default, otherwise the UTXO selection
    // would be failed.
    // SpecifiedFeeRate is from UI layer and is in BTC/byte, convert it to sats/byte
    const feeRate =
      typeof specifiedFeeRate !== 'undefined'
        ? new BigNumber(specifiedFeeRate)
            .shiftedBy(network.feeDecimals)
            .toFixed()
        : (await this.getFeeRate())[1];

    // Coin Control
    const frozenUtxos = await this.getFrozenUtxos(dbAccount.xpub, utxos);
    const allUtxosWithoutFrozen = utxos.filter(
      (utxo) =>
        frozenUtxos.findIndex(
          (frozenUtxo) => frozenUtxo.id === getUtxoId(this.networkId, utxo),
        ) < 0,
    );
    utxos = allUtxosWithoutFrozen;

    const allSelectedUtxos = transferInfos.reduce((acc: string[], info) => {
      if (Array.isArray(info.selectedUtxos) && info.selectedUtxos.length) {
        acc.push(...info.selectedUtxos);
      }
      return acc;
    }, []);

    if (Array.isArray(allSelectedUtxos) && allSelectedUtxos.length) {
      utxos = utxos.filter((utxo) =>
        (allSelectedUtxos ?? []).includes(getUtxoUniqueKey(utxo)),
      );
    }

    const inputsForCoinSelect: ICoinSelectUTXO[] = utxos.map(
      ({ txid, vout, value, address, path }) => ({
        txId: txid,
        vout,
        value: parseInt(value),
        address,
        path,
      }),
    );
    let outputsForCoinSelect: IEncodedTxBtc['outputsForCoinSelect'] = [];

    if (isBatchTransfer) {
      outputsForCoinSelect = transferInfos.map(({ to, amount }) => {
        if (isNftTransfer) {
          throw new Error(
            'NFT Inscription transfer can only be single transfer',
          );
        }
        return {
          address: to,
          value: parseInt(
            new BigNumber(amount).shiftedBy(network.decimals).toFixed(),
          ),
        };
      });
    } else {
      const transferInfo = transferInfos[0];
      const { to, amount } = transferInfo;

      const allUtxoAmount = allUtxosWithoutFrozen
        .reduce((v, { value }) => v.plus(value), new BigNumber('0'))
        .shiftedBy(-network.decimals);

      if (allUtxoAmount.lt(amount)) {
        throw new InsufficientBalance();
      }

      let max = allUtxoAmount.lte(amount);

      let value = parseInt(
        new BigNumber(amount).shiftedBy(network.decimals).toFixed(),
      );

      if (isNftTransfer) {
        // coinControl is not allowed in NFT transfer
        transferInfo.coinControlDisabled = true;
        // nft transfer should never be max transfer
        max = false;
        // value should be 546
        value = INSCRIPTION_PADDING_SATS_VALUES.default;
        let founded: ICoinSelectUTXO | undefined;
        for (const u of inputsForCoinSelect) {
          const matchedUtxo = forceSelectUtxos.find(
            (item) =>
              item.address === u.address &&
              item.txId === u.txId &&
              item.vout === u.vout,
          );
          if (matchedUtxo) {
            u.forceSelect = true;
            founded = u;
            break;
          }
        }
        if (!founded) {
          throw new Error('nftInscription output not found in utxos');
        }
      }

      outputsForCoinSelect = [
        max
          ? { address: to, isMax: true }
          : {
              address: to,
              value,
            },
      ];
    }

    const algorithm: ICoinSelectAlgorithm | undefined = !isBatchTransfer
      ? transferInfos[0].coinSelectAlgorithm
      : undefined;
    if (!isBatchTransfer && outputsForCoinSelect.length > 1) {
      throw new Error('single transfer should only have one output');
    }
    const { inputs, outputs, fee } = isNftTransfer
      ? coinSelectForOrdinal({
          inputsForCoinSelect,
          outputsForCoinSelect,
          feeRate,
        })
      : coinSelect({
          inputsForCoinSelect,
          outputsForCoinSelect,
          feeRate,
          algorithm,
        });
    return {
      inputs,
      outputs,
      fee,
      inputsForCoinSelect,
      outputsForCoinSelect,
      feeRate,
    };
  }

  override async getFrozenBalance(): Promise<number> {
    const { utxos, frozenValue } = await this.collectUTXOsInfo();
    const [dbAccount, network] = await Promise.all([
      this.getDbAccount() as Promise<DBUTXOAccount>,
      this.getNetwork(),
    ]);
    // find frozen utxo
    const frozenUtxos = await this.getFrozenUtxos(dbAccount.xpub, utxos);
    const allFrozenUtxo = utxos.filter((utxo) =>
      frozenUtxos.find(
        (frozenUtxo) => frozenUtxo.id === getUtxoId(this.networkId, utxo),
      ),
    );
    // use bignumber to calculate sum allFrozenUtxo value
    let frozenBalance = allFrozenUtxo.reduce(
      (sum, utxo) => sum.plus(utxo.value),
      new BigNumber(0),
    );
    if (frozenValue) {
      frozenBalance = frozenBalance.plus(frozenValue);
    }
    return Promise.resolve(
      frozenBalance.shiftedBy(-network.decimals).toNumber(),
    );
  }

  override async getUserNFTAssets({
    serviceData,
  }: {
    serviceData: NFTListItems;
  }): Promise<NFTAssetMeta | undefined> {
    return Promise.resolve({
      type: NFTAssetType.BTC,
      data: serviceData as NFTBTCAssetModel[],
    });
  }
}
