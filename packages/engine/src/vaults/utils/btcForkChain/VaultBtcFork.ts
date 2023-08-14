/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */

import BigNumber from 'bignumber.js';
import bs58check from 'bs58check';
import { isFunction, isNil } from 'lodash';

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
  isBRC20Token,
  parseBRC20Content,
} from '@onekeyhq/shared/src/utils/tokenUtils';

import {
  getUtxoId,
  getUtxoUniqueKey,
} from '../../../dbs/simple/entity/SimpleDbEntityUtxoAccounts';
import {
  InsufficientBalance,
  InvalidAddress,
  InvalidTokenAddress,
  NotImplemented,
  OneKeyInternalError,
  PreviousAccountIsEmpty,
  UtxoNotFoundError,
} from '../../../errors';
import {
  getDefaultPurpose,
  getLastAccountId,
} from '../../../managers/derivation';
import { getAccountNameInfoByTemplate } from '../../../managers/impl';
import {
  getBRC20TransactionHistory,
  getNFTTransactionHistory,
} from '../../../managers/nft';
import {
  type BTCTransactionsModel,
  NFTAssetType,
  type NFTBTCAssetModel,
  type NFTListItems,
} from '../../../types/nft';
import { BRC20TokenOperation } from '../../../types/token';
import { INSCRIPTION_PADDING_SATS_VALUES } from '../../impl/btc/inscribe/consts';
import { EVMDecodedTxType } from '../../impl/evm/decoder/types';
import {
  IDecodedTxActionType,
  IDecodedTxDirection,
  IDecodedTxStatus,
  IEncodedTxUpdateType,
} from '../../types';
import { VaultBase } from '../../VaultBase';
import { convertFeeValueToNative } from '../feeInfoUtils';

import { Provider } from './provider';
import { BlockBook, getRpcUrlFromChainInfo } from './provider/blockbook';
import {
  coinSelect,
  coinSelectForOrdinal,
  getAccountDefaultByPurpose,
  getBIP44Path,
} from './utils';

import type { ExportedPrivateKeyCredential } from '../../../dbs/base';
import type { BRC20TextProps, TxMapType } from '../../../managers/nft';
import type {
  Account,
  BtcForkChainUsedAccount,
  DBUTXOAccount,
} from '../../../types/account';
import type { NFTAssetMeta } from '../../../types/nft';
import type { Token } from '../../../types/token';
import type {
  CoinControlItem,
  ICoinControlListItem,
} from '../../../types/utxoAccounts';
import type { KeyringBaseMock } from '../../keyring/KeyringBase';
import type { KeyringHdBase } from '../../keyring/KeyringHdBase';
import type {
  IApproveInfo,
  IBalanceDetails,
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

  override async validateTokenAddress(address: string): Promise<string> {
    if (isBRC20Token(address)) {
      return Promise.resolve(address);
    }

    return Promise.reject(new InvalidTokenAddress());
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
    if (!input) {
      return Promise.resolve(false);
    }
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

    if (!ret) {
      console.error(
        `BTCfork validateWatchingCredential ERROR: not valid xpub:${input}`,
      );
      try {
        ret = Boolean(await this.validateAddress(input));
      } catch (error) {
        ret = false;
        console.error(
          `BTCfork validateWatchingCredential ERROR: not valid address:${input}`,
        );
      }
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

    let mainBalance: BigNumber | undefined; // do not set 0 as default here
    if (xpub) {
      [mainBalance] = await this.getBalances([{ address: xpub }]);
    } else if (account.address) {
      [mainBalance] = await this.getBalancesByAddress([
        { address: account.address },
      ]);
    }
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
    const { inputs, outputs } = encodedTx;
    const transferInfo = encodedTx.transferInfo ?? encodedTx.transferInfos?.[0];
    const network = await this.engine.getNetwork(this.networkId);
    const dbAccount = (await this.getDbAccount()) as DBUTXOAccount;
    const nativeToken = await this.engine.getNativeTokenInfo(this.networkId);

    const nftInfos = (payload?.nftInfos ?? [payload?.nftInfo]).filter(Boolean);

    const ordinalsUTXOs = transferInfo.isNFT
      ? inputs.filter((item) => item.forceSelect)
      : null;

    let actions = [] as IDecodedTxAction[];

    if (ordinalsUTXOs && ordinalsUTXOs.length > 0 && nftInfos.length > 0) {
      const nftInfo = nftInfos[0];

      const {
        content,
        content_type: contentType,
        contentUrl,
      } = nftInfo.asset as NFTBTCAssetModel;

      const { isBRC20Content, brc20Content } = await parseBRC20Content({
        content,
        contentType,
        contentUrl,
      });

      const tokenId =
        transferInfo.token ?? `brc-20--${brc20Content?.tick ?? ''}`;

      const tokenInfo = await this.engine.findToken({
        networkId: this.networkId,
        tokenIdOnNetwork: tokenId,
      });
      // only support batch transfer BRC20 token
      if (isBRC20Content && tokenInfo) {
        actions = nftInfos.map((info) =>
          this.buildBRC20TokenAction({
            nftInfo: info,
            dbAccount,
            token: tokenInfo,
            brc20Content,
          }),
        );
      } else {
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
      }
    } else {
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
      actions = utxoTo.map((utxo) => ({
        type: IDecodedTxActionType.NATIVE_TRANSFER,
        direction:
          outputs[0].address === dbAccount.address
            ? IDecodedTxDirection.OUT
            : IDecodedTxDirection.SELF,
        utxoFrom,
        utxoTo,
        nativeTransfer: {
          tokenInfo: nativeToken,
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

  buildBRC20TokenAction({
    nftInfo,
    token,
    dbAccount,
    brc20Content,
  }: {
    nftInfo: INFTInfo;
    token: Token;
    dbAccount: DBUTXOAccount;
    brc20Content?: BRC20TextProps | null;
  }) {
    const { from, to } = nftInfo;

    let actionType = IDecodedTxActionType.UNKNOWN;
    let direction = IDecodedTxDirection.OTHER;
    let info = {};

    if (brc20Content?.op === BRC20TokenOperation.Deploy) {
      actionType = IDecodedTxActionType.TOKEN_BRC20_DEPLOY;
      direction = IDecodedTxDirection.OUT;
      info = {
        limit: brc20Content.lim,
        max: brc20Content.max,
      };
    }

    if (brc20Content?.op === BRC20TokenOperation.Mint) {
      actionType = IDecodedTxActionType.TOKEN_BRC20_MINT;
      direction = IDecodedTxDirection.IN;
      info = {
        amount: brc20Content.amt,
      };
    }

    if (brc20Content?.op === BRC20TokenOperation.Transfer) {
      actionType = IDecodedTxActionType.TOKEN_BRC20_TRANSFER;

      info = {
        amount: brc20Content.amt,
      };

      if (from === to && from === dbAccount.address) {
        direction = IDecodedTxDirection.SELF;
      } else if (from === dbAccount.address) {
        direction = IDecodedTxDirection.OUT;
      } else if (to === dbAccount.address) {
        direction = IDecodedTxDirection.IN;
      }
    }

    if (!brc20Content)
      return {
        type: actionType,
        direction,
      };

    const action: IDecodedTxAction = {
      type: actionType,
      direction,
      brc20Info: {
        token,
        asset: nftInfo.asset as NFTBTCAssetModel,
        sender: nftInfo.from,
        receiver: nftInfo.to,
        extraInfo: null,
        ...info,
      },
    };

    return action;
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

    const { inputs } = (signedTx.encodedTx as IEncodedTxBtc) ?? { inputs: [] };

    const utoxIds = inputs.map((input) => getUtxoId(this.networkId, input));

    try {
      await simpleDb.utxoAccounts.deleteCoinControlItem(utoxIds);
    } catch {
      // pass
    }

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

  async buildActionsFromBTCTransaction({
    transaction,
    address,
  }: {
    transaction: BTCTransactionsModel;
    address: string;
  }): Promise<IDecodedTxAction[]> {
    let type: IDecodedTxActionType = IDecodedTxActionType.UNKNOWN;
    const { send, receive, event_type: eventType, asset } = transaction;

    if (!asset) {
      return [];
    }

    const { content_type: contentType, content, contentUrl } = asset;

    const { isBRC20Content, brc20Content } = await parseBRC20Content({
      content,
      contentType,
      contentUrl,
    });

    if (isBRC20Content) {
      const dbAccount = (await this.getDbAccount()) as DBUTXOAccount;
      const token = await this.engine.findToken({
        networkId: this.networkId,
        tokenIdOnNetwork: `brc-20--${brc20Content?.tick ?? ''}`,
      });

      if (token) {
        return [
          this.buildBRC20TokenAction({
            nftInfo: {
              asset,
              amount: '0',
              from: send,
              to: receive,
            },
            token,
            dbAccount,
            brc20Content,
          }),
        ];
      }
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

  async mergeNFTTransaction({
    nftTxs,
    nativeActions,
    address,
  }: {
    address: string;
    nftTxs: BTCTransactionsModel[];
    nativeActions: IDecodedTxAction[];
  }): Promise<IDecodedTxAction[]> {
    const nftActions = (
      await Promise.all(
        nftTxs?.map((transaction) =>
          this.buildActionsFromBTCTransaction({
            transaction,
            address,
          }),
        ) ?? '',
      )
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

    if (tokenIdOnNetwork && isBRC20Token(tokenIdOnNetwork)) {
      const history = await getBRC20TransactionHistory(
        dbAccount.address,
        tokenIdOnNetwork,
      );
      // TODO brc20 token history
    }

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

    const promises = txs.map(async (tx) => {
      try {
        const historyTxToMerge = localHistory.find(
          (item) => item.decodedTx.txid === tx.txid,
        );
        // if (historyTxToMerge && historyTxToMerge.decodedTx.isFinal) {
        //   // No need to update.
        //   return null;
        // }

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

        const mergeNFTActions = await this.mergeNFTTransaction({
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
        if (utxosInfo.ordQueryStatus === 'ERROR') {
          // @ts-ignore
          if (isFunction(provider.getUTXOs.clear)) {
            try {
              // @ts-ignore
              // eslint-disable-next-line @typescript-eslint/no-unsafe-call
              provider.getUTXOs.clear();
            } catch (error) {
              // console.error(error);
            } finally {
              // noop
            }
          }
        }
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
        // Find the index of the first negative fee.
        let negativeIndex = fees.findIndex((val) => new BigNumber(val).lt(0));

        // Keep replacing if there is any negative fee in the array.
        while (negativeIndex >= 0) {
          let leftIndex = negativeIndex - 1;
          let rightIndex = negativeIndex + 1;

          // eslint-disable-next-line no-constant-condition
          while (true) {
            if (leftIndex >= 0 && new BigNumber(fees[leftIndex]).gte(0)) {
              fees[negativeIndex] = fees[leftIndex];
              break;
            }

            if (
              rightIndex < fees.length &&
              new BigNumber(fees[rightIndex]).gte(0)
            ) {
              fees[negativeIndex] = fees[rightIndex];
              break;
            }

            // Move pointers to expand searching range.
            leftIndex -= 1;
            rightIndex += 1;

            if (leftIndex < 0 && rightIndex >= fees.length) {
              break;
            }
          }

          // Find the next negative fee after replacement.
          negativeIndex = fees.findIndex((val) => new BigNumber(val).lt(0));
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

  private async getRecycleInscriptionUtxos(xpub: string) {
    const archivedUtxos = await simpleDb.utxoAccounts.getCoinControlList(
      this.networkId,
      xpub,
    );
    const recycleInscriptionUtxos = archivedUtxos.filter(
      (utxo) => utxo.recycle,
    );

    return recycleInscriptionUtxos;
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

    const isBRC20Transfer = Boolean(transferInfos.find((item) => item.isBRC20));

    const isInscribeTransfer = Boolean(
      transferInfos.find((item) => item.isInscribe),
    );
    const network = await this.engine.getNetwork(this.networkId);
    const dbAccount = (await this.getDbAccount()) as DBUTXOAccount;
    const forceSelectUtxos: ICoinSelectUTXOLite[] = [];
    if (isNftTransfer) {
      // only support BRC20 batch transfer
      if (isBatchTransfer && !isBRC20Transfer) {
        throw new Error('BTC nft transfer is not supported in batch transfer');
      }

      transferInfos.forEach((transferInfo) => {
        const { nftInscription } = transferInfo;
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
      });
    } else if (!isInscribeTransfer) {
      // only native btc transfer can select inscription utxos marked as recycle utxos
      const recycleUtxos = await this.getRecycleInscriptionUtxos(
        dbAccount.xpub,
      );

      recycleUtxos.forEach((utxo) => {
        const [txId, vout] = utxo.key.split('_');
        forceSelectUtxos.push({
          txId,
          vout: parseInt(vout, 10),
          address: dbAccount.address,
        });
      });
    }

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
      if (isNftTransfer && !isBRC20Transfer) {
        throw new Error('NFT Inscription transfer can only be single transfer');
      }

      if (isBRC20Transfer) {
        const { values } = this.validateInscriptionInputsForCoinSelect({
          inputsForCoinSelect,
          forceSelectUtxos,
        });

        outputsForCoinSelect = transferInfos.map(({ to }, index) => ({
          address: to,
          value: values[index],
        }));
      } else {
        outputsForCoinSelect = transferInfos.map(({ to, amount }) => ({
          address: to,
          value: parseInt(
            new BigNumber(amount).shiftedBy(network.decimals).toFixed(),
          ),
        }));
      }
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
        const { values } = this.validateInscriptionInputsForCoinSelect({
          inputsForCoinSelect,
          forceSelectUtxos,
        });
        [value] = values;
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

  private validateInscriptionInputsForCoinSelect({
    inputsForCoinSelect,
    forceSelectUtxos,
  }: {
    inputsForCoinSelect: ICoinSelectUTXO[];
    forceSelectUtxos: ICoinSelectUTXOLite[];
  }) {
    const foundedUtxos: ICoinSelectUTXO[] = [];
    const values = [];
    for (const u of inputsForCoinSelect) {
      const matchedUtxo = forceSelectUtxos.find(
        (item) =>
          item.address === u.address &&
          item.txId === u.txId &&
          item.vout === u.vout,
      );
      if (matchedUtxo) {
        // TODO inscription offset testing
        // keep the original value of inscription
        if (u.value < 0 || isNil(u.value)) {
          throw new Error('Sending inscription utxo value is not valid.');
        }
        u.forceSelect = true;
        values.push(u.value);
        foundedUtxos.push(u);
        if (forceSelectUtxos.length === 1) {
          break;
        }
      }
    }
    if (foundedUtxos.length === 0) {
      throw new UtxoNotFoundError();
    }

    return {
      foundedUtxos,
      values,
    };
  }

  override async getFrozenBalance({
    useRecycleBalance,
  }: { useRecycleBalance?: boolean } = {}): Promise<number> {
    const result = await this.fetchBalanceDetails({ useRecycleBalance });
    if (result && !isNil(result?.unavailable)) {
      return new BigNumber(result.unavailable).toNumber();
    }
    throw new Error('getFrozenBalance ERROR');
  }

  override async fetchBalanceDetails({
    useRecycleBalance,
  }: {
    useRecycleBalance?: boolean;
  } = {}): Promise<IBalanceDetails | undefined> {
    const [dbAccount, network] = await Promise.all([
      this.getDbAccount() as Promise<DBUTXOAccount>,
      this.getNetwork(),
    ]);
    const recycleUtxos = await this.getRecycleInscriptionUtxos(dbAccount.xpub);
    const { utxos, valueDetails, ordQueryStatus } = await this.collectUTXOsInfo(
      useRecycleBalance
        ? {
            forceSelectUtxos: recycleUtxos.map((utxo) => {
              const [txId, vout] = utxo.key.split('_');
              return {
                txId,
                vout: parseInt(vout, 10),
                address: dbAccount.address,
              };
            }),
          }
        : undefined,
    );
    if (ordQueryStatus === 'ERROR') {
      this.collectUTXOsInfo.clear();
    }

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
    let unavailableValue = frozenBalance;
    if (valueDetails?.unavailableValue) {
      unavailableValue = unavailableValue.plus(valueDetails?.unavailableValue);
    }

    const unavailableOfLocalFrozen = convertFeeValueToNative({
      value: frozenBalance,
      network,
    });
    const unavailable = convertFeeValueToNative({
      value: unavailableValue,
      network,
    });
    const totalBalance = utxos.reduce(
      (sum, utxo) => sum.plus(utxo.value),
      new BigNumber(0),
    );
    const total = convertFeeValueToNative({
      value: valueDetails?.totalValue ?? totalBalance,
      network,
    });
    const available = new BigNumber(total).minus(unavailable).toFixed();

    let unavailableOfUnconfirmed: string | undefined;
    let unavailableOfInscription: string | undefined; // BTC Inscription value
    let unavailableOfUnchecked: string | undefined; // BTC not verified value by ordinals

    if (valueDetails) {
      const {
        unavailableValueOfUnchecked,
        unavailableValueOfUnconfirmed,
        unavailableValueOfInscription,
      } = valueDetails;
      const isNonZeroBalance = (v: string) => v && new BigNumber(v).gt(0);
      if (isNonZeroBalance(unavailableValueOfUnchecked))
        unavailableOfUnchecked = convertFeeValueToNative({
          value: unavailableValueOfUnchecked,
          network,
        });
      if (isNonZeroBalance(unavailableValueOfUnconfirmed))
        unavailableOfUnconfirmed = convertFeeValueToNative({
          value: unavailableValueOfUnconfirmed,
          network,
        });
      if (isNonZeroBalance(unavailableValueOfInscription))
        unavailableOfInscription = convertFeeValueToNative({
          value: unavailableValueOfInscription,
          network,
        });
    }

    const result: IBalanceDetails = {
      errorMessageKey:
        ordQueryStatus === 'ERROR'
          ? 'msg__the_ordinal_service_failure_refresh_and_try_again'
          : undefined,
      total,
      available,
      unavailable,
      unavailableOfLocalFrozen,
      unavailableOfInscription,
      unavailableOfUnconfirmed,
      unavailableOfUnchecked,
    };
    return Promise.resolve(result);
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
