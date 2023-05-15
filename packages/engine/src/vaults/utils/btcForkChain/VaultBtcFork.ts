/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */

import BigNumber from 'bignumber.js';
import bs58check from 'bs58check';
import memoizee from 'memoizee';

import type { BaseClient } from '@onekeyhq/engine/src/client/BaseClient';
import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import { decrypt } from '@onekeyhq/engine/src/secret/encryptors/aes256';
import type { TransactionStatus } from '@onekeyhq/engine/src/types/provider';
import type {
  IBlockBookTransaction,
  IBtcUTXO,
  IEncodedTxBtc,
  IUTXOInput,
  IUTXOOutput,
  PartialTokenInfo,
  TxInput,
} from '@onekeyhq/engine/src/vaults/utils/btcForkChain/types';
import { appSelector } from '@onekeyhq/kit/src/store';
import {
  COINTYPE_BTC,
  IMPL_BTC,
} from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

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
import { coinSelect, getAccountDefaultByPurpose, getBIP44Path } from './utils';

import type { ExportedPrivateKeyCredential } from '../../../dbs/base';
import type {
  Account,
  BtcForkChainUsedAccount,
  DBUTXOAccount,
} from '../../../types/account';
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
  IDecodedTxActionNativeTransfer,
  IDecodedTxLegacy,
  IEncodedTx,
  IEncodedTxUpdateOptions,
  IFeeInfo,
  IFeeInfoUnit,
  IHistoryTx,
  ISignedTxPro,
  ITransferInfo,
  IUnsignedTxPro,
  IVaultSettings,
} from '../../types';
import type { IKeyringMapKey } from '../../VaultBase';

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
    const feeRate = params.feeInfoValue.feeRate
      ? new BigNumber(params.feeInfoValue.feeRate)
          .shiftedBy(-network.feeDecimals)
          .toFixed()
      : params.feeInfoValue.price;
    if (typeof feeRate === 'string') {
      return this.buildEncodedTxFromTransfer(
        params.encodedTx.transferInfo,
        feeRate,
      );
    }
    return Promise.resolve(params.encodedTx);
  }

  decodedTxToLegacy(decodedTx: IDecodedTx): Promise<IDecodedTxLegacy> {
    const { type, nativeTransfer } = decodedTx.actions[0];
    if (
      type !== IDecodedTxActionType.NATIVE_TRANSFER ||
      typeof nativeTransfer === 'undefined'
    ) {
      // shouldn't happen.
      throw new OneKeyInternalError('Incorrect decodedTx.');
    }
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

  async decodeTx(encodedTx: IEncodedTxBtc, payload?: any): Promise<IDecodedTx> {
    const { inputs, outputs } = encodedTx;
    const network = await this.engine.getNetwork(this.networkId);
    const dbAccount = (await this.getDbAccount()) as DBUTXOAccount;
    const token = await this.engine.getNativeTokenInfo(this.networkId);
    const nativeTransfer: IDecodedTxActionNativeTransfer = {
      tokenInfo: token,
      utxoFrom: inputs.map((input) => ({
        address: input.address,
        balance: new BigNumber(input.value)
          .shiftedBy(-network.decimals)
          .toFixed(),
        balanceValue: input.value,
        symbol: network.symbol,
        isMine: true,
      })),
      utxoTo: outputs.map((output) => ({
        address: output.address,
        balance: new BigNumber(output.value)
          .shiftedBy(-network.decimals)
          .toFixed(),
        balanceValue: output.value,
        symbol: network.symbol,
        isMine: output.address === dbAccount.address,
      })),
      from: dbAccount.address,
      to: outputs[0].address,
      amount: new BigNumber(outputs[0].value)
        .shiftedBy(-network.decimals)
        .toFixed(),
      amountValue: outputs[0].value,
      extraInfo: null,
    };
    return {
      txid: '',
      owner: dbAccount.address,
      signer: dbAccount.address,
      nonce: 0,
      actions: [
        {
          type: IDecodedTxActionType.NATIVE_TRANSFER,
          direction:
            outputs[0].address === dbAccount.address
              ? IDecodedTxDirection.OUT
              : IDecodedTxDirection.SELF,
          nativeTransfer,
        },
      ],
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
    const { to, amount } = transferInfo;
    const network = await this.engine.getNetwork(this.networkId);
    const dbAccount = (await this.getDbAccount()) as DBUTXOAccount;
    let utxos = await this.collectUTXOs();

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
    if (
      Array.isArray(transferInfo.selectedUtxos) &&
      transferInfo.selectedUtxos.length
    ) {
      utxos = utxos.filter((utxo) =>
        (transferInfo.selectedUtxos ?? []).includes(getUtxoUniqueKey(utxo)),
      );
    }

    const max = allUtxosWithoutFrozen
      .reduce((v, { value }) => v.plus(value), new BigNumber('0'))
      .shiftedBy(-network.decimals)
      .lte(amount);

    const inputsForCoinSelect = utxos.map(
      ({ txid, vout, value, address, path }) => ({
        txId: txid,
        vout,
        value: parseInt(value),
        address,
        path,
      }),
    );
    const outputsForCoinSelect = [
      max
        ? { address: to }
        : {
            address: to,
            value: parseInt(
              new BigNumber(amount).shiftedBy(network.decimals).toFixed(),
            ),
          },
    ];
    const {
      inputs,
      outputs,
      fee,
    }: {
      inputs: IUTXOInput[];
      outputs: IUTXOOutput[];
      fee: number;
    } = coinSelect(inputsForCoinSelect, outputsForCoinSelect, feeRate);

    if (!inputs || !outputs) {
      throw new InsufficientBalance('Failed to select UTXOs');
    }
    const totalFee = fee.toString();
    const totalFeeInNative = new BigNumber(totalFee)
      .shiftedBy(-1 * network.feeDecimals)
      .toFixed();
    return {
      inputs: inputs.map(({ txId, value, ...keep }) => ({
        ...keep,
        txid: txId,
        value: value.toString(),
      })),
      outputs: outputs.map(({ value, address }) => ({
        address: address || dbAccount.address, // change amount
        value: value.toString(),
        payload: address
          ? undefined
          : {
              isCharge: true,
              bip44Path: getBIP44Path(dbAccount, dbAccount.address),
            },
      })),
      totalFee,
      totalFeeInNative,
      transferInfo,
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
    const feeList = prices.map(
      (price) =>
        coinSelect(
          encodedTx.inputsForCoinSelect,
          encodedTx.outputsForCoinSelect,
          new BigNumber(price).shiftedBy(network.feeDecimals).toFixed(),
        ).fee,
    );

    const blockNums = this.getDefaultBlockNums();
    return {
      isBtcForkChain: true,
      limit: (feeLimit ?? new BigNumber(0)).toFixed(), // bytes in BTC
      prices,
      feeList,
      waitingSeconds: blockNums.map(
        (numOfBlocks) => numOfBlocks * this.getDefaultBlockTime(),
      ),
      defaultPresetIndex: '1',
      feeSymbol: 'BTC',
      feeDecimals: network.feeDecimals,
      nativeSymbol: network.symbol,
      nativeDecimals: network.decimals,
      tx: null, // Must be null if network not support feeInTx
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

  override async fetchOnChainHistory(options: {
    tokenIdOnNetwork?: string;
    localHistory?: IHistoryTx[];
  }): Promise<IHistoryTx[]> {
    const { localHistory = [] } = options;

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

        const decodedTx: IDecodedTx = {
          txid: tx.txid,
          owner: dbAccount.address,
          signer: dbAccount.address,
          nonce: 0,
          actions: [
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
          ],
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

  collectUTXOs = memoizee(
    async () => {
      const provider = await this.getProvider();
      const dbAccount = (await this.getDbAccount()) as DBUTXOAccount;
      try {
        return await provider.getUTXOs(this.getAccountXpub(dbAccount));
      } catch (e) {
        console.error(e);
        throw new OneKeyInternalError('Failed to get UTXOs of the account.');
      }
    },
    {
      promise: true,
      max: 1,
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
        return fees.sort((a, b) => {
          const aBN = new BigNumber(a);
          const bBN = new BigNumber(b);
          if (aBN.gt(bBN)) return 1;
          if (aBN.lt(bBN)) return -1;
          return 0;
        });
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
    return Promise.resolve(bs58check.decode(credential));
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

  override async getFrozenBalance(): Promise<number> {
    const utxos = await this.collectUTXOs();
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
    const frozenBalance = allFrozenUtxo.reduce(
      (sum, utxo) => sum.plus(utxo.value),
      new BigNumber(0),
    );
    return Promise.resolve(
      frozenBalance.shiftedBy(-network.decimals).toNumber(),
    );
  }
}
