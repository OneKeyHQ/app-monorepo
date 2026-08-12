import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';
import { Semaphore } from 'async-mutex';
import BigNumber from 'bignumber.js';
import { Psbt } from 'bitcoinjs-lib';
import { isEmpty, isNil } from 'lodash';

import {
  getInputsToSignFromPsbt,
  getSignPsbtOptionsForPsbtIndex,
} from '@onekeyhq/core/src/chains/btc/sdkBtc';
import {
  buildOwnedAddressesForBatchDisplay,
  computeBatchPsbtAmounts,
  finalizeSignedPsbtHex,
  findDuplicatePsbtIndexes,
  findPsbtOutpointConflicts,
  outpointToDisplay,
} from '@onekeyhq/core/src/chains/btc/sdkBtc/batchPsbt';
import {
  parseHexContext,
  validateAppName,
} from '@onekeyhq/core/src/chains/btc/sdkBtc/deriveContextHash';
import {
  decodedPsbt as decodedPsbtFN,
  formatPsbtHex,
  toPsbtNetwork,
} from '@onekeyhq/core/src/chains/btc/sdkBtc/providerUtils';
import type {
  IBtcInput,
  IBtcOutput,
  IEncodedTxBtc,
} from '@onekeyhq/core/src/chains/btc/types';
import type { IEncodedTx, ITxInputToSign } from '@onekeyhq/core/src/types';
import {
  backgroundClass,
  providerApiMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { BTCFreshAddressCanNotConnectDappError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import { EBatchTxSignItemStatus } from '@onekeyhq/shared/types/batchTxSign';
import {
  BtcDappUniSetChainTypes,
  EBtcDappUniSetChainTypeEnum,
  type IDeriveContextHashParams,
  type IPushPsbtParams,
  type ISendBitcoinParams,
  type ISignMessageParams,
  type ISignPsbtOptions,
  type ISignPsbtParams,
  type ISignPsbtsParams,
  type ISwitchNetworkParams,
} from '@onekeyhq/shared/types/ProviderApis/ProviderApiBtc.type';
import type { IPushTxParams } from '@onekeyhq/shared/types/ProviderApis/ProviderApiSui.type';

import { vaultFactory } from '../vaults/factory';

import ProviderApiBase from './ProviderApiBase';

import type { IProviderBaseBackgroundNotifyInfo } from './ProviderApiBase';
import type { IDBUtxoAccount } from '../dbs/local/types';
import type { IBatchTxSignCreateItem } from '../services/ServiceBatchTxSign';
import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';
import type * as BitcoinJS from 'bitcoinjs-lib';

// Defensive bounds on multi-psbt `signPsbts` requests (dapp-supplied input),
// far above any real marketplace batch: the batch flow parses and retains
// every item upfront, so these only exist to stop a malicious dapp from
// stalling/exhausting the JS heaps with an absurd payload.
const MAX_SIGN_PSBTS_COUNT = 100;
// Total hex-string length across all psbts (2 hex chars per byte): 20M chars
// ≈ 10MB of raw psbt data.
const MAX_SIGN_PSBTS_TOTAL_HEX_LENGTH = 20_000_000;

@backgroundClass()
class ProviderApiBtc extends ProviderApiBase {
  public providerName = IInjectedProviderNames.btc;

  private semaphore = new Semaphore(1);

  private readonly BTC_FRESH_ADDRESS_DIALOG_DEBOUNCE_MS =
    timerUtils.getTimeDurationMs({ seconds: 1 });

  private btcFreshAddressConnectDialogCooling = false;

  private btcFreshAddressConnectDialogCooldownTimer?: ReturnType<
    typeof setTimeout
  >;

  public override notifyDappAccountsChanged(
    info: IProviderBaseBackgroundNotifyInfo,
  ): void {
    const data = async ({ origin }: { origin: string }) => {
      const params = await this.getAccounts({
        origin,
        scope: this.providerName,
      });
      const result = {
        method: 'wallet_events_accountsChanged',
        params,
      };
      return result;
    };
    info.send(data, info.targetOrigin);
  }

  public override notifyDappChainChanged(
    info: IProviderBaseBackgroundNotifyInfo,
  ): void {
    const data = async ({ origin }: { origin: string }) => {
      const params = await this.getNetwork({
        origin,
        scope: this.providerName,
      });
      const result = {
        method: 'wallet_events_networkChanged',
        params,
      };
      return result;
    };
    info.send(data, info.targetOrigin);
    this.notifyNetworkChangedToDappSite(info.targetOrigin);
  }

  public async rpcCall(): Promise<any> {
    throw web3Errors.rpc.methodNotSupported();
  }

  @providerApiMethod()
  public async getProviderState() {
    return {
      network: '',
      isUnlocked: true,
      accounts: [],
    };
  }

  private resetFreshAddressConnectDialogDebounceTimer() {
    if (this.btcFreshAddressConnectDialogCooldownTimer) {
      clearTimeout(this.btcFreshAddressConnectDialogCooldownTimer);
    }
    this.btcFreshAddressConnectDialogCooldownTimer = setTimeout(() => {
      this.btcFreshAddressConnectDialogCooling = false;
      this.btcFreshAddressConnectDialogCooldownTimer = undefined;
    }, this.BTC_FRESH_ADDRESS_DIALOG_DEBOUNCE_MS);
  }

  private emitBtcFreshAddressConnectDappRejectedWithDebounce() {
    if (this.btcFreshAddressConnectDialogCooling) {
      this.resetFreshAddressConnectDialogDebounceTimer();
      return;
    }
    this.btcFreshAddressConnectDialogCooling = true;
    appEventBus.emit(
      EAppEventBusNames.BtcFreshAddressConnectDappRejected,
      undefined,
    );
    this.resetFreshAddressConnectDialogDebounceTimer();
  }

  private async checkIfEnableConnect() {
    const enabledBTCFreshAddress =
      await this.backgroundApi.serviceSetting.getEnableBTCFreshAddress();
    if (enabledBTCFreshAddress) {
      this.emitBtcFreshAddressConnectDappRejectedWithDebounce();
      throw new BTCFreshAddressCanNotConnectDappError();
    }
  }

  // Provider API
  @providerApiMethod()
  public async requestAccounts(request: IJsBridgeMessagePayload) {
    this.tryFocusPendingApprovalWindow(request);
    return this.semaphore.runExclusive(async () => {
      defaultLogger.discovery.dapp.dappRequest({ request });
      await this.checkIfEnableConnect();
      const accounts = await this.getAccounts(request);
      if (accounts && accounts.length) {
        return accounts;
      }
      await this.backgroundApi.serviceDApp.openConnectionModal(request);
      void this._getConnectedNetworkName(request);
      return this.getAccounts(request);
    });
  }

  @providerApiMethod()
  async getAccounts(request: IJsBridgeMessagePayload) {
    const accountsInfo =
      await this.backgroundApi.serviceDApp.dAppGetConnectedAccountsInfo(
        request,
      );
    if (!accountsInfo) {
      return Promise.resolve([]);
    }
    return Promise.resolve(accountsInfo.map((i) => i.account.address));
  }

  @providerApiMethod()
  public async getPublicKey(request: IJsBridgeMessagePayload) {
    const accountsInfo =
      await this.backgroundApi.serviceDApp.dAppGetConnectedAccountsInfo(
        request,
      );
    if (!accountsInfo) {
      return Promise.resolve('');
    }
    return Promise.resolve(accountsInfo[0]?.account?.pub);
  }

  @providerApiMethod()
  public async getNetwork(request: IJsBridgeMessagePayload) {
    try {
      const networks =
        await this.backgroundApi.serviceDApp.getConnectedNetworks({
          origin: request.origin ?? '',
          scope: request.scope ?? this.providerName,
        });
      if (Array.isArray(networks) && networks.length) {
        return await networkUtils.getBtcDappNetworkName(networks[0]);
      }
      return '';
    } catch {
      return '';
    }
  }

  @providerApiMethod()
  public async switchNetwork(
    request: IJsBridgeMessagePayload,
    params: ISwitchNetworkParams,
  ) {
    defaultLogger.discovery.dapp.dappRequest({ request });
    const accountsInfo =
      await this.backgroundApi.serviceDApp.dAppGetConnectedAccountsInfo(
        request,
      );
    if (!accountsInfo) {
      return;
    }
    const { accountInfo: { networkId: oldNetworkId } = {} } = accountsInfo[0];

    if (!oldNetworkId) {
      return;
    }

    const { network: networkName } = params;
    let networkId;
    if (networkName === 'livenet') {
      networkId = getNetworkIdsMap().btc;
    } else if (networkName === 'testnet') {
      networkId = getNetworkIdsMap().tbtc;
    } else if (networkName === 'signet') {
      networkId = getNetworkIdsMap().sbtc;
    }
    if (!networkId) {
      throw web3Errors.provider.custom({
        code: 4000,
        message: `Unrecognized network ${networkName}.`,
      });
    }
    try {
      await this.backgroundApi.serviceDApp.switchConnectedNetwork({
        origin: request.origin ?? '',
        scope: request.scope ?? this.providerName,
        oldNetworkId,
        newNetworkId: networkId,
      });
      this.notifyNetworkChangedToDappSite(request.origin ?? '');
    } catch (e: any) {
      const { message } = e || {};
      throw web3Errors.provider.custom({
        code: 4000,
        message: message ?? 'Switch network failed',
      });
    }
    const network = await this.getNetwork(request);
    return network;
  }

  @providerApiMethod()
  public async getChain(request: IJsBridgeMessagePayload) {
    const defaultNetwork = await this.backgroundApi.serviceNetwork.getNetwork({
      networkId: getNetworkIdsMap().btc,
    });
    const defaultChain =
      await networkUtils.getBtcDappNetworkName(defaultNetwork);
    try {
      const networks =
        await this.backgroundApi.serviceDApp.getConnectedNetworks({
          origin: request.origin ?? '',
          scope: request.scope ?? this.providerName,
        });
      if (Array.isArray(networks) && networks.length) {
        return await networkUtils.getBtcDappUniSetChainName(networks[0]);
      }
      return defaultChain;
    } catch (e) {
      console.log('getChain error: ', e);
      return defaultChain;
    }
  }

  @providerApiMethod()
  public async switchChain(
    request: IJsBridgeMessagePayload,
    params: { chain: EBtcDappUniSetChainTypeEnum },
  ) {
    defaultLogger.discovery.dapp.dappRequest({ request });
    const accountsInfo =
      await this.backgroundApi.serviceDApp.dAppGetConnectedAccountsInfo(
        request,
      );
    if (!accountsInfo) {
      return;
    }
    const { accountInfo: { networkId: oldNetworkId } = {} } = accountsInfo[0];

    if (!oldNetworkId) {
      return undefined;
    }

    let networkId;
    if (params.chain === EBtcDappUniSetChainTypeEnum.BITCOIN_MAINNET) {
      networkId = getNetworkIdsMap().btc;
    } else if (params.chain === EBtcDappUniSetChainTypeEnum.BITCOIN_TESTNET) {
      networkId = getNetworkIdsMap().tbtc;
    } else if (params.chain === EBtcDappUniSetChainTypeEnum.BITCOIN_SIGNET) {
      networkId = getNetworkIdsMap().sbtc;
    }

    if (!networkId) {
      throw web3Errors.provider.custom({
        code: 4000,
        message: `Unrecognized network ${params.chain}.`,
      });
    }

    const chain = BtcDappUniSetChainTypes[params.chain];

    try {
      await this.backgroundApi.serviceDApp.switchConnectedNetwork({
        origin: request.origin ?? '',
        scope: request.scope ?? this.providerName,
        oldNetworkId,
        newNetworkId: networkId,
      });
      this.notifyNetworkChangedToDappSite(request.origin ?? '');
      return chain;
    } catch (e: any) {
      const { message } = e || {};
      throw web3Errors.provider.custom({
        code: 4000,
        message: message ?? 'Switch network failed',
      });
    }
  }

  @providerApiMethod()
  public async getBalance(request: IJsBridgeMessagePayload) {
    const { accountInfo: { networkId, accountId } = {} } = (
      await this.getAccountsInfo(request)
    )[0];

    const { balance } =
      await this.backgroundApi.serviceAccountProfile.fetchAccountDetails({
        networkId: networkId ?? '',
        accountId: accountId ?? '',
      });
    return {
      confirmed: balance,
      unconfirmed: 0,
      total: balance,
    };
  }

  @providerApiMethod()
  public async getBalanceV2(request: IJsBridgeMessagePayload) {
    const { accountInfo: { networkId, accountId } = {} } = (
      await this.getAccountsInfo(request)
    )[0];

    const { balance } =
      await this.backgroundApi.serviceAccountProfile.fetchAccountDetails({
        networkId: networkId ?? '',
        accountId: accountId ?? '',
      });
    return {
      available: balance,
      unavailable: 0,
      total: balance,
    };
  }

  @providerApiMethod()
  public async getBitcoinUtxos(
    request: IJsBridgeMessagePayload,
    params?: { cursor?: number; size?: number },
  ) {
    const { accountInfo: { networkId, accountId } = {} } = (
      await this.getAccountsInfo(request)
    )[0];

    const { utxoList } =
      await this.backgroundApi.serviceAccountProfile.fetchAccountDetails({
        networkId: networkId ?? '',
        accountId: accountId ?? '',
        withUTXOList: true,
      });

    const mappedUtxos =
      utxoList?.map((it) => {
        const bn = new BigNumber(it.value ?? 0);
        const satoshis = bn.isNaN() ? 0 : bn.toNumber();

        return {
          txid: it.txid,
          vout: it.vout,
          pubkey: it.txPubkey,
          satoshis,
          scriptPk: it.scriptPublicKey,
        };
      }) ?? [];

    const { cursor = 0, size = mappedUtxos.length } = params ?? {};
    return mappedUtxos.slice(cursor, cursor + size);
  }

  @providerApiMethod()
  public async getInscriptions() {
    throw web3Errors.rpc.methodNotSupported();
  }

  @providerApiMethod()
  public async sendBitcoin(
    request: IJsBridgeMessagePayload,
    params: ISendBitcoinParams,
  ) {
    defaultLogger.discovery.dapp.dappRequest({ request });
    const { toAddress, satoshis, feeRate } = params;
    const accountsInfo = await this.getAccountsInfo(request);
    const { accountInfo: { accountId, networkId, address } = {} } =
      accountsInfo[0];

    if (!networkId || !accountId) {
      throw web3Errors.provider.custom({
        code: 4002,
        message: `Can not get account`,
      });
    }

    const amountBN = new BigNumber(satoshis);

    if (amountBN.isNaN() || amountBN.isNegative()) {
      throw web3Errors.rpc.invalidParams('Invalid satoshis');
    }

    const vault = await vaultFactory.getVault({
      networkId,
      accountId,
    });
    const network = await this.backgroundApi.serviceNetwork.getNetwork({
      networkId,
    });

    const transfersInfo = [
      {
        from: address ?? '',
        to: toAddress,
        amount: amountBN.shiftedBy(-network.decimals).toFixed(),
      },
    ];
    const encodedTx = await vault.buildEncodedTx({
      transfersInfo,
      specifiedFeeRate: isNil(feeRate)
        ? undefined
        : new BigNumber(feeRate).shiftedBy(-network.feeMeta.decimals).toFixed(),
    });

    const result =
      await this.backgroundApi.serviceDApp.openSignAndSendTransactionModal({
        request,
        encodedTx,
        accountId: accountId ?? '',
        networkId: networkId ?? '',
        transfersInfo,
      });
    return result.txid;
  }

  @providerApiMethod()
  public async signMessage(
    request: IJsBridgeMessagePayload,
    params: ISignMessageParams,
  ) {
    defaultLogger.discovery.dapp.dappRequest({ request });
    await this.checkIfEnableConnect();
    const { message, type } = params;
    const accountsInfo = await this.getAccountsInfo(request);
    const { accountInfo: { accountId, networkId } = {} } = accountsInfo[0];

    if (type !== 'bip322-simple' && type !== 'ecdsa') {
      throw web3Errors.rpc.invalidParams('Invalid type');
    }

    const result = await this.backgroundApi.serviceDApp.openSignMessageModal({
      request,
      accountId: accountId ?? '',
      networkId: networkId ?? '',
      unsignedMessage: {
        type,
        message,
        sigOptions: {
          noScriptType: true,
        },
        payload: {
          isFromDApp: true,
        },
      },
    });
    return Buffer.from(result as string, 'hex').toString('base64');
  }

  @providerApiMethod()
  public async deriveContextHash(
    request: IJsBridgeMessagePayload,
    params: IDeriveContextHashParams,
  ): Promise<string> {
    // request.data is logged and folded into the modal route's $sourceInfo —
    // strip the inline params before any logging/openModal call.
    const sanitizedData = ((): unknown => {
      const data = request.data as
        | { method?: unknown; id?: unknown }
        | undefined;
      if (!data || typeof data !== 'object') return undefined;
      return {
        method: data.method,
        ...(data.id !== undefined ? { id: data.id } : {}),
        params: '[redacted]',
      };
    })();
    const sanitizedRequest: IJsBridgeMessagePayload = {
      ...request,
      data: sanitizedData,
    };

    defaultLogger.discovery.dapp.dappRequest({ request: sanitizedRequest });
    await this.checkIfEnableConnect();

    if (
      !params ||
      typeof params.appName !== 'string' ||
      typeof params.context !== 'string'
    ) {
      throw web3Errors.rpc.invalidParams(
        'deriveContextHash requires { appName: string, context: string }',
      );
    }
    try {
      validateAppName(params.appName);
      parseHexContext(params.context);
    } catch (e) {
      throw web3Errors.rpc.invalidParams(
        e instanceof Error ? e.message : String(e),
      );
    }

    const accountsInfo = await this.getAccountsInfo(request);
    const { accountInfo: { accountId, networkId, walletId, address } = {} } =
      accountsInfo[0] ?? {};
    if (!accountId || !networkId || !walletId) {
      throw web3Errors.provider.custom({
        code: 4002,
        message: 'Can not get account',
      });
    }

    // Only HD wallets have a recoverable master seed; everything else fails fast.
    if (!accountUtils.isHdWallet({ walletId })) {
      throw web3Errors.rpc.methodNotSupported();
    }

    const nonce =
      await this.backgroundApi.serviceDApp.stageDeriveContextHashRequest({
        accountId,
        networkId,
        walletId,
        address: address ?? '',
        appName: params.appName,
        context: params.context,
      });

    return this.backgroundApi.serviceDApp.openDeriveContextHashModal({
      request: sanitizedRequest,
      nonce,
    });
  }

  @providerApiMethod()
  public async sendInscription() {
    throw web3Errors.rpc.methodNotSupported();
  }

  @providerApiMethod()
  public async inscribeTransfer() {
    throw web3Errors.rpc.methodNotSupported();
  }

  @providerApiMethod()
  public async pushTx(request: IJsBridgeMessagePayload, params: IPushTxParams) {
    defaultLogger.discovery.dapp.dappRequest({ request });
    const { rawTx } = params;
    const accountsInfo = await this.getAccountsInfo(request);
    const { accountInfo: { accountId, networkId, address } = {} } =
      accountsInfo[0];

    if (!networkId || !accountId) {
      throw web3Errors.provider.custom({
        code: 4002,
        message: `Can not get account`,
      });
    }

    const vault = await vaultFactory.getVault({
      networkId,
      accountId,
    });
    const result = await vault.broadcastTransaction({
      accountId,
      accountAddress: address ?? '',
      networkId,
      signedTx: {
        txid: '',
        rawTx,
        encodedTx: null,
      },
    });

    return result.txid;
  }

  @providerApiMethod()
  public async signPsbt(
    request: IJsBridgeMessagePayload,
    params: ISignPsbtParams,
  ) {
    defaultLogger.discovery.dapp.dappRequest({ request });
    await this.checkIfEnableConnect();
    const accountsInfo = await this.getAccountsInfo(request);
    const { accountInfo: { accountId, networkId } = {} } = accountsInfo[0];

    if (!networkId || !accountId) {
      throw web3Errors.provider.custom({
        code: 4002,
        message: `Can not get account`,
      });
    }

    // if (accountUtils.isHwAccount({ accountId })) {
    //   throw web3Errors.provider.custom({
    //     code: 4003,
    //     message:
    //       'Partially signed bitcoin transactions is not supported on hardware.',
    //   });
    // }

    const network = await this.backgroundApi.serviceNetwork.getNetwork({
      networkId,
    });
    if (!network) return null;

    const { psbtHex, options } = params;
    const formattedPsbtHex = formatPsbtHex(psbtHex);
    const psbtNetwork = toPsbtNetwork(network);
    const psbt = Psbt.fromHex(formattedPsbtHex, { network: psbtNetwork });
    const respPsbtHex = await this._signPsbt(request, {
      psbt,
      psbtNetwork,
      options,
    });

    return respPsbtHex;
  }

  @providerApiMethod()
  public async signPsbts(
    request: IJsBridgeMessagePayload,
    params: ISignPsbtsParams,
  ) {
    defaultLogger.discovery.dapp.dappRequest({ request });
    await this.checkIfEnableConnect();
    const accountsInfo = await this.getAccountsInfo(request);
    const { accountInfo: { accountId, networkId } = {} } = accountsInfo[0];

    if (!networkId || !accountId) {
      throw web3Errors.provider.custom({
        code: 4002,
        message: `Can not get account`,
      });
    }

    const network = await this.backgroundApi.serviceNetwork.getNetwork({
      networkId,
    });
    if (!network) return null;

    const { psbtHexs, options } = params;
    if (!Array.isArray(psbtHexs) || psbtHexs.length === 0) {
      throw web3Errors.rpc.invalidParams('psbtHexs must be a non-empty array');
    }
    // Defensive bounds for multi-psbt requests, checked before anything is
    // parsed: the batch flow decodes every item upfront and keeps the whole
    // set alive in the background for the lifetime of the modal (mirrored
    // into the UI runtime on split-runtime targets), so unbounded input from
    // a connected dapp could otherwise stall or exhaust both JS heaps. The
    // limits are far above any real marketplace batch. A single psbt keeps
    // the unchecked legacy behavior byte-for-byte.
    if (psbtHexs.length > 1) {
      if (psbtHexs.length > MAX_SIGN_PSBTS_COUNT) {
        throw web3Errors.rpc.invalidParams(
          `too many psbts: ${psbtHexs.length} (max ${MAX_SIGN_PSBTS_COUNT})`,
        );
      }
      const totalHexLength = psbtHexs.reduce(
        (sum, hex) => sum + (typeof hex === 'string' ? hex.length : 0),
        0,
      );
      if (totalHexLength > MAX_SIGN_PSBTS_TOTAL_HEX_LENGTH) {
        throw web3Errors.rpc.invalidParams('psbts payload too large');
      }
    }

    const psbtNetwork = toPsbtNetwork(network);

    // Batch flow supports hd / imported / hw accounts. QR (air-gap), external
    // and watching accounts keep the legacy per-psbt modal loop; a single psbt
    // always uses the legacy path (product decision).
    const supportsBatchFlow =
      psbtHexs.length > 1 &&
      (accountUtils.isHdAccount({ accountId }) ||
        accountUtils.isImportedAccount({ accountId }) ||
        accountUtils.isHwAccount({ accountId }));

    if (!supportsBatchFlow) {
      return this._signPsbtsLegacyFlow(request, {
        psbtHexs,
        options,
        psbtNetwork,
      });
    }

    return this._signPsbtsBatchFlow(request, {
      accountId,
      networkId,
      psbtHexs,
      options,
      psbtNetwork,
    });
  }

  // The pre-batch sequential per-psbt confirm loop, kept byte-for-byte: one
  // modal per psbt, each resolved through the single-psbt `_signPsbt` path.
  private async _signPsbtsLegacyFlow(
    request: IJsBridgeMessagePayload,
    {
      psbtHexs,
      options,
      psbtNetwork,
    }: {
      psbtHexs: string[];
      options: ISignPsbtOptions | ISignPsbtOptions[];
      psbtNetwork: BitcoinJS.networks.Network;
    },
  ): Promise<string[]> {
    const result: string[] = [];
    for (let i = 0; i < psbtHexs.length; i += 1) {
      // UniSat-compatible `signPsbts` passes `options` as an array (one
      // entry per psbt), while OneKey/legacy callers pass a single shared
      // object. Extract per-psbt options for the array form so
      // `toSignInputs`, `isBtcWalletProvider` and `autoFinalized` are not
      // lost. Losing them makes `getInputsToSignFromPsbt` skip script-path
      // inputs (e.g. Babylon staking, whose input address differs from the
      // account address), yielding an empty `inputsToSign` that throws in
      // `buildDecodedPsbtTx` and hangs the confirm page on an infinite
      // loading skeleton.
      const optionsForCurrentPsbt = getSignPsbtOptionsForPsbtIndex({
        options,
        index: i,
      });
      const formattedPsbtHex = formatPsbtHex(psbtHexs[i]);
      const psbt = Psbt.fromHex(formattedPsbtHex, { network: psbtNetwork });
      const respPsbtHex = await this._signPsbt(request, {
        psbt,
        psbtNetwork,
        options: optionsForCurrentPsbt,
      });
      result.push(respPsbtHex);
    }

    return result;
  }

  private async _signPsbtsBatchFlow(
    request: IJsBridgeMessagePayload,
    {
      accountId,
      networkId,
      psbtHexs,
      options,
      psbtNetwork,
    }: {
      accountId: string;
      networkId: string;
      psbtHexs: string[];
      options: ISignPsbtOptions | ISignPsbtOptions[];
      psbtNetwork: BitcoinJS.networks.Network;
    },
  ): Promise<string[]> {
    const account = await this.backgroundApi.serviceAccount.getAccount({
      accountId,
      networkId,
    });

    const psbts: Psbt[] = [];
    const perItemOptions: (ISignPsbtOptions | undefined)[] = [];
    for (let i = 0; i < psbtHexs.length; i += 1) {
      try {
        psbts.push(
          Psbt.fromHex(formatPsbtHex(psbtHexs[i]), { network: psbtNetwork }),
        );
      } catch (error) {
        throw web3Errors.rpc.invalidParams(
          `invalid psbt at index ${i}: ${(error as Error)?.message ?? ''}`,
        );
      }
      perItemOptions.push(
        getSignPsbtOptionsForPsbtIndex({ options, index: i }),
      );
    }

    const duplicateIndexes = findDuplicatePsbtIndexes(psbts);
    if (duplicateIndexes.length > 0) {
      throw web3Errors.rpc.invalidParams(
        `duplicate psbt at index ${duplicateIndexes.join(', ')}`,
      );
    }

    // NOTE: isBtcWalletProvider is dapp-supplied; this exemption makes the
    // conflict check an accident guard, not a security boundary — per-item
    // display and input ownership remain the real controls.
    const exemptIndexes = perItemOptions
      .map((o, i) => (o?.isBtcWalletProvider ? i : -1))
      .filter((i) => i >= 0);
    const conflicts = findPsbtOutpointConflicts({ psbts, exemptIndexes });
    if (conflicts.length > 0) {
      const displayOutpoint = outpointToDisplay(conflicts[0].outpoint);
      throw web3Errors.rpc.invalidParams(
        `conflicting inputs across psbts (double spend): ${displayOutpoint}`,
      );
    }

    // getAccount() spreads the DB account, so the UTXO address maps ride
    // along on the network account — no extra DB read needed here.
    const utxoAccount = account as unknown as IDBUtxoAccount;
    const ownedAddresses = buildOwnedAddressesForBatchDisplay({
      primaryAddress: account.address,
      addressMaps: [
        utxoAccount.addresses,
        utxoAccount.customAddresses,
        utxoAccount.findAddresses,
      ],
    });

    const items: IBatchTxSignCreateItem[] = [];
    for (let i = 0; i < psbts.length; i += 1) {
      const psbt = psbts[i];
      const itemOptions = perItemOptions[i];
      const { encodedTx, inputsToSign } = await this.buildPsbtSignFlowPayload({
        psbt,
        psbtNetwork,
        options: itemOptions,
        accountId,
        networkId,
        // Drift (accepted): legacy _signPsbt uses the dapp connection's
        // accountInfo.address, while the batch flow uses getAccount().address
        // here — only affects the isChange display flag, never signing.
        address: account.address,
        account,
      });
      if (!inputsToSign.length) {
        throw web3Errors.rpc.invalidParams(
          `psbt at index ${i} has no inputs owned by the current account`,
        );
      }
      // Change recognition covers every wallet-owned address (primary +
      // derived + custom + claimed find-address), so change returned to any
      // of them is never displayed as an external transfer.
      const amounts = computeBatchPsbtAmounts({
        psbt,
        psbtNetwork,
        accountAddresses: ownedAddresses,
      });
      if (!amounts) {
        // A psbt whose amounts/fee can't be summarized honestly must never
        // reach the batch overview with made-up numbers — but rejecting
        // outright would regress flows the sequential loop has always
        // handled: a SIGHASH_SINGLE|ANYONECANPAY marketplace listing psbt
        // (seller-side, buyer adds the fee inputs later) legitimately
        // computes a negative fee here. Fall back to the legacy per-psbt
        // confirm for the whole request instead.
        return this._signPsbtsLegacyFlow(request, {
          psbtHexs,
          options,
          psbtNetwork,
        });
      }
      items.push({
        unsignedTx: {
          uuid: '',
          accountId,
          networkId,
          encodedTx,
        },
        summary: {
          index: i,
          recipient: amounts.externalRecipients[0] ?? '',
          extraRecipientCount: Math.max(
            0,
            amounts.externalRecipients.length - 1,
          ),
          amountValue: amounts.externalOutValue,
          feeValue: amounts.feeValue,
          status: EBatchTxSignItemStatus.Ready,
        },
        inputsToSign,
        autoFinalized: itemOptions?.autoFinalized,
      });
    }

    const { batchId } = await this.backgroundApi.serviceBatchTxSign.createBatch(
      {
        accountId,
        networkId,
        items,
      },
    );
    try {
      const result =
        await this.backgroundApi.serviceDApp.openBatchTxConfirmModal({
          request,
          accountId,
          networkId,
          batchId,
        });
      return result;
    } finally {
      // No-op if takeFinalizedResults already disposed it; aborts the queue
      // if the modal died (extension popup closed, request rejected).
      await this.backgroundApi.serviceBatchTxSign.disposeBatch({ batchId });
    }
  }

  private async buildPsbtSignFlowPayload({
    psbt,
    psbtNetwork,
    options,
    accountId,
    networkId,
    address,
    account: providedAccount,
  }: {
    psbt: Psbt;
    psbtNetwork: BitcoinJS.networks.Network;
    options?: ISignPsbtOptions;
    accountId: string;
    networkId: string;
    address?: string;
    // Batch flow already resolved the account once for the whole batch and
    // passes it here to avoid a redundant getAccount call per item. Legacy
    // `_signPsbt` does not pass it, so its behavior is unchanged.
    account?: INetworkAccount;
  }): Promise<{
    encodedTx: IEncodedTxBtc;
    inputsToSign: ITxInputToSign[];
  }> {
    const decodedPsbt = decodedPsbtFN({ psbt, psbtNetwork });

    const account =
      providedAccount ??
      (await this.backgroundApi.serviceAccount.getAccount({
        accountId,
        networkId,
      }));

    let inputsToSign: ITxInputToSign[] = [];
    if (
      Array.isArray(options?.toSignInputs) &&
      options?.toSignInputs.length > 0
    ) {
      inputsToSign = options.toSignInputs.map((input) => ({
        index: input.index,
        publicKey: input.publicKey || account.pub || '',
        address: input.address || account.address || '',
        sighashTypes: input.sighashTypes,
        disableTweakSigner: input.disableTweakSigner,
        useTweakedSigner: input.useTweakedSigner,
      }));
    } else {
      inputsToSign = getInputsToSignFromPsbt({
        psbt,
        psbtNetwork,
        account,
        isBtcWalletProvider: options?.isBtcWalletProvider ?? false,
      });
    }

    const inputAddresses = new Map<string, BigNumber>();
    decodedPsbt.inputInfos.forEach((input) => {
      const value = new BigNumber(input.value?.toString() ?? 0);
      const addressKey = input.address;
      if (addressKey) {
        inputAddresses.set(
          addressKey,
          (inputAddresses.get(addressKey) || new BigNumber(0)).plus(value),
        );
      }
    });

    const outputAddresses = new Map<string, BigNumber>();
    decodedPsbt.outputInfos.forEach((output) => {
      const value = new BigNumber(output.value?.toString() ?? 0);
      const addressKey = output.address;
      if (addressKey) {
        outputAddresses.set(
          addressKey,
          (outputAddresses.get(addressKey) || new BigNumber(0)).plus(value),
        );
      }
    });

    // Check for change address:
    // 1. More than one output
    // 2. Not all output addresses are the same as the current account address
    // This often happens in BRC-20 transfer transactions
    const hasChangeAddress =
      decodedPsbt.outputInfos.length > 1 &&
      !(decodedPsbt.outputInfos ?? []).every((v) => v.address === address);

    const outputs: IBtcOutput[] = (decodedPsbt.outputInfos ?? []).map((v) => {
      const isChange = hasChangeAddress ? v.address === address : false;
      // check if the output is an inscription structure output
      const inputValue =
        inputAddresses.get(v.address ?? '') || new BigNumber(0);
      const outputValue =
        outputAddresses.get(v.address ?? '') || new BigNumber(0);
      // allow 1000 satoshi error for fee
      const isInscriptionStructure = inputValue
        .minus(outputValue)
        .abs()
        .lt(1000);

      return {
        ...v,
        value: new BigNumber(v.value?.toString() ?? 0).toFixed(),
        payload: {
          isChange,
          isInscriptionStructure,
        },
      };
    });

    const encodedTx: IEncodedTxBtc = {
      inputs: (decodedPsbt.inputInfos ?? []).map((v) => ({
        ...v,
        path: '',
        value: new BigNumber(v.value?.toString() ?? 0).toFixed(),
      })) as IBtcInput[],
      outputs,
      inputsForCoinSelect: [],
      outputsForCoinSelect: [],
      fee: new BigNumber(decodedPsbt.fee).toFixed(),
      inputsToSign,
      psbtHex: psbt.toHex(),
      disabledCoinSelect: true,
      txSize: undefined,
    };

    return { encodedTx, inputsToSign };
  }

  async _signPsbt(
    request: IJsBridgeMessagePayload,
    params: {
      psbt: Psbt;
      psbtNetwork: BitcoinJS.networks.Network;
      options?: ISignPsbtOptions;
    },
  ) {
    const accountsInfo = await this.getAccountsInfo(request);
    const { accountInfo: { accountId, networkId, address } = {} } =
      accountsInfo[0];

    if (!networkId || !accountId) {
      throw web3Errors.provider.custom({
        code: 4002,
        message: `Can not get account`,
      });
    }

    const { psbt, psbtNetwork, options } = params;

    const { encodedTx, inputsToSign } = await this.buildPsbtSignFlowPayload({
      psbt,
      psbtNetwork,
      options,
      accountId,
      networkId,
      address,
    });

    const resp =
      await this.backgroundApi.serviceDApp.openSignAndSendTransactionModal({
        request,
        accountId,
        networkId,
        encodedTx,
        signOnly: true,
      });

    if (!resp.psbtHex) {
      throw web3Errors.provider.custom({
        code: 4001,
        message: 'Failed to sign psbt',
      });
    }

    // KNOWN BEHAVIOR NOTE: the old tail always round-tripped
    // Psbt.fromHex(...).toHex() even when autoFinalized === false; this
    // helper returns the hex untouched in that case instead. Bytes are
    // equivalent for our own signer output, so this is intentional.
    const respPsbtHex = finalizeSignedPsbtHex({
      signedPsbtHex: resp.psbtHex,
      psbtNetwork,
      inputsToSign,
      autoFinalized: options?.autoFinalized,
    });
    return respPsbtHex;
  }

  @providerApiMethod()
  public async pushPsbt(
    request: IJsBridgeMessagePayload,
    params: IPushPsbtParams,
  ) {
    defaultLogger.discovery.dapp.dappRequest({ request });
    const accountsInfo = await this.getAccountsInfo(request);
    const { accountInfo: { accountId, networkId, address } = {} } =
      accountsInfo[0];

    if (!networkId || !accountId) {
      throw web3Errors.provider.custom({
        code: 4002,
        message: `Can not get account`,
      });
    }

    const { psbtHex } = params;

    const formattedPsbtHex = formatPsbtHex(psbtHex);
    const psbt = Psbt.fromHex(formattedPsbtHex);
    const tx = psbt.extractTransaction();
    const rawTx = tx.toHex();

    const vault = await vaultFactory.getVault({
      networkId,
      accountId,
    });
    const result = await vault.broadcastTransaction({
      accountAddress: address ?? '',
      accountId,
      networkId,
      signedTx: {
        txid: '',
        rawTx,
        encodedTx: null,
      },
    });

    return result.txid;
  }

  @providerApiMethod()
  public async getNetworkFees(request: IJsBridgeMessagePayload) {
    const accountsInfo = await this.getAccountsInfo(request);
    const { accountInfo: { networkId, accountId } = {} } = accountsInfo[0];

    if (!networkId || !accountId) {
      throw web3Errors.provider.custom({
        code: 4002,
        message: `Can not get account`,
      });
    }
    const accountAddress =
      await this.backgroundApi.serviceAccount.getAccountAddressForApi({
        networkId,
        accountId,
      });

    const { encodedTx } =
      await this.backgroundApi.serviceGas.buildEstimateFeeParams({
        accountId,
        networkId,
        encodedTx: {} as IEncodedTx,
      });

    const result = await this.backgroundApi.serviceGas.estimateFee({
      accountId,
      networkId,
      encodedTx,
      accountAddress,
    });
    if (result.feeUTXO && result.feeUTXO.length === 3) {
      const fastestFee = Number(result.feeUTXO[0].feeRate);
      const halfHourFee = Number(result.feeUTXO[1].feeRate);
      const hourFee = Number(result.feeUTXO[2].feeRate);
      return {
        fastestFee,
        halfHourFee,
        hourFee,
        economyFee: hourFee,
        minimumFee: hourFee,
      };
    }
    throw web3Errors.provider.custom({
      code: 4001,
      message: 'Failed to get network fees',
    });
  }

  @providerApiMethod()
  public async getUtxos(
    request: IJsBridgeMessagePayload,
    params: {
      address: string;
      amount: number;
    },
  ) {
    const accountsInfo = await this.getAccountsInfo(request);
    const { accountInfo: { networkId, accountId } = {} } = accountsInfo[0];

    if (!networkId || !accountId) {
      throw web3Errors.provider.custom({
        code: 4002,
        message: `Can not get account`,
      });
    }

    const { utxoList } =
      await this.backgroundApi.serviceAccountProfile.fetchAccountDetails({
        networkId,
        accountId,
        withUTXOList: true,
      });
    if (!utxoList || isEmpty(utxoList)) {
      throw web3Errors.provider.custom({
        code: 4001,
        message: 'Failed to get UTXO list',
      });
    }
    const utxos = utxoList;
    const confirmedUtxos = utxos.filter(
      (v) => v.address === params.address && Number(v?.confirmations ?? 0) > 0,
    );
    let sum = 0;
    let index = 0;
    for (const utxo of confirmedUtxos) {
      sum += new BigNumber(utxo.value).toNumber();
      index += 1;
      if (sum > params.amount) {
        break;
      }
    }
    if (sum < params.amount) {
      return [];
    }
    const sliced = confirmedUtxos.slice(0, index);
    const result = [];
    for (const utxo of sliced) {
      // TODO: get scriptPubKey from txDetails by Api
      const txDetails = {} as any;
      result.push({
        txid: utxo.txid,
        vout: utxo.vout,
        value: new BigNumber(utxo.value).toNumber(),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        scriptPubKey: txDetails?.vout?.[utxo.vout].hex ?? '',
      });
    }

    return result;
  }

  @providerApiMethod()
  public async getBTCTipHeight(request: IJsBridgeMessagePayload) {
    const accountsInfo = await this.getAccountsInfo(request);
    const { accountInfo: { networkId } = {} } = accountsInfo[0];
    return this._getBlockHeightMemo({
      networkId,
      origin: request.origin ?? '',
    });
  }

  private _getBlockHeightMemo = memoizee(
    async (params: { networkId?: string; origin: string }) => {
      const { networkId, origin } = params;
      if (!networkId) return undefined;
      const [result] = await this.backgroundApi.serviceDApp.proxyRPCCall({
        networkId,
        request: {
          method: 'get',
          // @ts-expect-error
          url: '/api/v2',
        },
        skipParseResponse: true,
        origin,
      });
      // @ts-expect-error
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const blockHeight = result?.data?.blockbook?.bestHeight;
      if (blockHeight) {
        return Number(blockHeight);
      }
      return undefined;
    },
    {
      promise: true,
      maxAge: timerUtils.getTimeDurationMs({ seconds: 30 }),
    },
  );
}

export default ProviderApiBtc;
