import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';
import { Semaphore } from 'async-mutex';
import BigNumber from 'bignumber.js';
import * as ethUtils from 'ethereumjs-util';
import stringify from 'fast-json-stable-stringify';
import { get, isNil } from 'lodash';

import { hashMessage } from '@onekeyhq/core/src/chains/evm/message';
import { autoFixPersonalSignMessage } from '@onekeyhq/core/src/chains/evm/sdkEvm/signMessage';
import type { IEncodedTxEvm } from '@onekeyhq/core/src/chains/evm/types';
import {
  backgroundClass,
  permissionRequired,
  providerApiMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { HYPER_LIQUID_ORIGIN } from '@onekeyhq/shared/src/consts/perp';
import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';
import type { OneKeyError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EVM_SAFE_RPC_METHODS } from '@onekeyhq/shared/src/rpcCache/constants';
import { RpcCache } from '@onekeyhq/shared/src/rpcCache/RpcCache';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { check } from '@onekeyhq/shared/src/utils/assertUtils';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { IHyperLiquidTypedDataApproveAgent } from '@onekeyhq/shared/types/hyperliquid';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';
import type {
  IAccountToken,
  IEthWatchAssetParameter,
} from '@onekeyhq/shared/types/token';

import ProviderApiBase from './ProviderApiBase';

import type { IProviderBaseBackgroundNotifyInfo } from './ProviderApiBase';
import type {
  IJsBridgeMessagePayload,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';

export type ISwitchEthereumChainParameter = {
  chainId: string;
  // networkId?: string; // not use?
};

export type IAddEthereumChainParameter = {
  chainId: string;
  blockExplorerUrls?: string[];
  chainName?: string;
  iconUrls?: string[];
  nativeCurrency?: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls?: string[];
};

function convertToEthereumChainResult(
  result: IServerNetwork | undefined | null,
) {
  return {
    id: result?.id,
    impl: result?.impl,
    symbol: result?.symbol,
    decimals: result?.decimals,
    logoURI: result?.logoURI,
    shortName: result?.shortname,
    shortCode: result?.shortcode,
    chainId: result?.chainId,
    networkVersion: undefined,
  };
}

function prefixTxValueToHex(value: string) {
  if (value?.startsWith?.('0X') && value?.slice) {
    // eslint-disable-next-line no-param-reassign
    value = value.slice(2);
  }
  if (
    value &&
    value.startsWith &&
    !value.startsWith('0x') &&
    !value.startsWith('0X')
  ) {
    return `0x${value}`;
  }
  return value;
}

@backgroundClass()
class ProviderApiEthereum extends ProviderApiBase {
  public providerName = IInjectedProviderNames.ethereum;

  private semaphore = new Semaphore(1);

  private rpcSemaphore = new Semaphore(10);

  private _rpcCache?: RpcCache;

  // Map to duplicate concurrent requests with same parameters
  private _duplicateRequestsMap: Map<string, Promise<any>> = new Map();

  // return a mocked chainId in non-evm, as empty string may cause dapp error
  private _getNetworkMockInfo() {
    return {
      chainId: '0x736d17dc',
      networkVersion: '1936529372',
    };
  }

  private get rpcCache() {
    if (!this._rpcCache) {
      this._rpcCache = new RpcCache({
        maxAge: timerUtils.getTimeDurationMs({ seconds: 10 }),
        impl: IMPL_EVM,
      });
    }
    return this._rpcCache;
  }

  public async notifyHyperliquidPerpConfigChanged(
    info: IProviderBaseBackgroundNotifyInfo,
    params: {
      hyperliquidBuilderAddress: string | undefined;
      hyperliquidMaxBuilderFee: number | undefined;
    },
  ) {
    info.send(
      {
        method: 'onekeyWalletEvents_builtInPerpConfigChanged',
        params: {
          hyperliquidBuilderAddress: params.hyperliquidBuilderAddress,
          hyperliquidMaxBuilderFee: params.hyperliquidMaxBuilderFee,
        },
      },
      // only notify to hyperliquid official dapp
      HYPER_LIQUID_ORIGIN,
    );
  }

  public override notifyDappAccountsChanged(
    info: IProviderBaseBackgroundNotifyInfo,
  ): void {
    const data = async ({ origin }: { origin: string }) => {
      const result = {
        method: 'metamask_accountsChanged',
        params: await this.eth_accounts({ origin, scope: this.providerName }),
      };
      return result;
    };
    info.send(data, info.targetOrigin);
  }

  public override notifyDappChainChanged(
    info: IProviderBaseBackgroundNotifyInfo,
  ): void {
    const data = async ({ origin }: { origin: string }) => {
      const result = {
        method: 'metamask_chainChanged',
        params: {
          chainId: await this.eth_chainId({ origin, scope: this.providerName }),
          networkVersion: await this.net_version({
            origin,
            scope: this.providerName,
          }),
        },
      };

      return result;
    };

    info.send(data, info.targetOrigin);
    this.notifyNetworkChangedToDappSite(info.targetOrigin);
  }

  public async rpcCall(request: IJsBridgeMessagePayload): Promise<any> {
    const { data } = request;
    const rpcRequest = data as IJsonRpcRequest;
    const { method } = rpcRequest;

    const { accountInfo: { networkId, address } = {} } = (
      await this.getAccountsInfo(request)
    )[0];

    const { params } = rpcRequest;

    if (!EVM_SAFE_RPC_METHODS.includes(method)) {
      defaultLogger.discovery.dapp.dappRequestNotSupport({ request });
      throw web3Errors.rpc.methodNotSupported();
    }

    if (!address || !networkId) {
      throw web3Errors.rpc.invalidParams('unauthorized');
    }

    // Check cache first
    const cache = this.rpcCache.get({
      address,
      networkId,
      data: { method, params },
    });

    if (cache) {
      console.log('ethRpc cache hit: ===> ', method);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return cache;
    }

    const requestKey = this.rpcCache.generateKey({
      address,
      networkId,
      data: { method, params },
    });

    // Check if there's a duplicate request in progress
    const duplicateRequest = this._duplicateRequestsMap.get(requestKey);
    if (duplicateRequest) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return duplicateRequest;
    }

    // Create a new promise for this request
    const promise = this.rpcSemaphore.runExclusive(async () => {
      try {
        const [result] = await this.backgroundApi.serviceDApp.proxyRPCCall({
          networkId: networkId ?? '',
          request: rpcRequest,
          origin: request.origin ?? '',
        });

        this.rpcCache.set({
          address,
          networkId,
          data: { method, params },
          value: result,
        });

        return result;
      } finally {
        // Remove from duplication map after completion
        this._duplicateRequestsMap.delete(requestKey);
      }
    });

    // Store the promise for duplication
    this._duplicateRequestsMap.set(requestKey, promise);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return promise;
  }

  @providerApiMethod()
  async eth_requestAccounts(request: IJsBridgeMessagePayload) {
    return this.semaphore.runExclusive(async () => {
      const accounts = await this.eth_accounts(request);
      if (accounts && accounts.length) {
        return accounts;
      }
      await this.backgroundApi.serviceDApp.openConnectionModal(request);
      void this._getConnectedNetworkName(request);
      return this.eth_accounts(request);
    });
  }

  @providerApiMethod()
  async eth_coinbase(request: IJsBridgeMessagePayload): Promise<string | null> {
    const accounts = await this.eth_accounts(request);
    return accounts?.[0] || null;
  }

  @providerApiMethod()
  async eth_accounts(request: IJsBridgeMessagePayload): Promise<string[]> {
    console.log('eth_accounts', request.origin, request.data);
    if (!request.data) {
      // TODO maybe called by notifyDAppAccountsChanged
      // debugger;
    }
    const accountsInfo =
      await this.backgroundApi.serviceDApp.dAppGetConnectedAccountsInfo(
        request,
      );
    if (!accountsInfo) {
      return Promise.resolve([]);
    }
    return Promise.resolve(
      accountsInfo.map((i) => i.account?.addressDetail.normalizedAddress),
    );
  }

  @providerApiMethod()
  async wallet_requestPermissions(
    request: IJsBridgeMessagePayload,
    permissions: Record<string, unknown>,
  ) {
    defaultLogger.discovery.dapp.dappRequest({ request });
    await this.backgroundApi.serviceDApp.openConnectionModal(request);
    const accounts = await this.eth_accounts(request);
    const result = Object.keys(permissions).map((permissionName) => {
      if (permissionName === 'eth_accounts') {
        return {
          caveats: [
            {
              type: 'restrictReturnedAccounts',
              value: [accounts[0]],
            },
          ],
          date: Date.now(),
          id: request.id?.toString() ?? generateUUID(),
          invoker: request.origin,
          parentCapability: permissionName,
        };
      }

      return {
        caveats: [],
        date: Date.now(),
        id: request.id?.toString() ?? generateUUID(),
        invoker: request.origin,
        parentCapability: permissionName,
      };
    });

    void this._getConnectedNetworkName(request);
    return result;
  }

  @providerApiMethod()
  async wallet_getPermissions(request: IJsBridgeMessagePayload) {
    const result = [
      {
        caveats: [],
        date: Date.now(),
        id: request.id?.toString(),
        invoker: request.origin as string,
        parentCapability: 'eth_accounts',
      },
    ];
    return Promise.resolve(result);
  }

  @providerApiMethod()
  async eth_chainId(request: IJsBridgeMessagePayload) {
    const networks = await this.backgroundApi.serviceDApp.getConnectedNetworks(
      request,
    );
    if (!isNil(networks?.[0]?.chainId)) {
      return hexUtils.hexlify(Number(networks?.[0]?.chainId), {
        removeZeros: true,
      });
    }

    return this._getNetworkMockInfo().chainId;
  }

  @providerApiMethod()
  async net_version(request: IJsBridgeMessagePayload) {
    const networks = await this.backgroundApi.serviceDApp.getConnectedNetworks(
      request,
    );
    if (!isNil(networks?.[0]?.chainId)) {
      return networks?.[0]?.chainId;
    }
    return this._getNetworkMockInfo().networkVersion;
  }

  @providerApiMethod()
  async metamask_getProviderState(request: IJsBridgeMessagePayload) {
    const [accounts, chainId, networkVersion, isUnlocked] = await Promise.all([
      this.eth_accounts(request),
      this.eth_chainId(request),
      this.net_version(request),
      this._getCurrentUnlockState(),
    ]);
    return {
      accounts,
      chainId,
      networkVersion,
      isUnlocked,
    };
  }

  @providerApiMethod()
  eth_signTransaction() {
    throw web3Errors.provider.unsupportedMethod();
  }

  @permissionRequired()
  @providerApiMethod()
  async eth_sendTransaction(
    request: IJsBridgeMessagePayload,
    transaction: IEncodedTxEvm,
  ) {
    defaultLogger.discovery.dapp.dappRequest({ request });
    const { accountInfo: { accountId, networkId } = {} } = (
      await this.getAccountsInfo(request)
    )[0];

    if (!isNil(transaction.value)) {
      transaction.value = prefixTxValueToHex(transaction.value);
    }

    const nonceBN = new BigNumber(transaction.nonce ?? 0);
    const gasPriceBN = new BigNumber(transaction.gasPrice ?? 0);

    // https://app.chainspot.io/
    // some dapp may send tx with incorrect nonce 0
    if (nonceBN.isNaN() || nonceBN.isLessThanOrEqualTo(0)) {
      delete transaction.nonce;
    }

    if (gasPriceBN.isNaN() || gasPriceBN.isLessThanOrEqualTo(0)) {
      delete transaction.gasPrice;
    }

    const result =
      await this.backgroundApi.serviceDApp.openSignAndSendTransactionModal({
        request,
        encodedTx: transaction,
        accountId: accountId ?? '',
        networkId: networkId ?? '',
      });

    console.log('eth_sendTransaction DONE', result, request, transaction);

    return result.txid;
  }

  @providerApiMethod()
  eth_subscribe(request: IJsBridgeMessagePayload) {
    defaultLogger.discovery.dapp.dappRequestNotSupport({ request });
    throw web3Errors.rpc.methodNotSupported();
  }

  @providerApiMethod()
  eth_unsubscribe(request: IJsBridgeMessagePayload) {
    defaultLogger.discovery.dapp.dappRequestNotSupport({ request });
    throw web3Errors.rpc.methodNotSupported();
  }

  @providerApiMethod()
  async wallet_watchAsset(
    request: IJsBridgeMessagePayload,
    params: IEthWatchAssetParameter,
  ) {
    const {
      accountInfo: {
        walletId,
        accountId,
        networkId,
        indexedAccountId,
        deriveType,
      } = {},
    } = (await this.getAccountsInfo(request))[0];
    const contractAddress = params.options.address;
    if (!contractAddress) {
      throw web3Errors.rpc.invalidParams('contractAddress is required');
    }

    try {
      await this.backgroundApi.serviceDApp.openAddCustomTokenModal({
        request,
        token: {
          address: contractAddress,
        } as IAccountToken,
        walletId: walletId ?? '',
        isOthersWallet: accountUtils.isOthersWallet({
          walletId: walletId ?? '',
        }),
        indexedAccountId,
        accountId: accountId ?? '',
        networkId: networkId ?? '',
        deriveType: deriveType ?? 'default',
      });
      return true;
    } catch {
      return false;
    }
  }

  @providerApiMethod()
  async eth_sign(request: IJsBridgeMessagePayload, ...messages: any[]) {
    defaultLogger.discovery.dapp.dappRequest({ request });
    const { accountInfo: { accountId, networkId } = {} } = (
      await this.getAccountsInfo(request)
    )[0];
    return this.backgroundApi.serviceDApp.openSignMessageModal({
      request,
      unsignedMessage: {
        type: EMessageTypesEth.ETH_SIGN,
        message: messages[1],
        payload: messages,
      },
      accountId: accountId ?? '',
      networkId: networkId ?? '',
    });
  }

  // Provider API
  @providerApiMethod()
  async personal_sign(request: IJsBridgeMessagePayload, ...messages: any[]) {
    defaultLogger.discovery.dapp.dappRequest({ request });
    const {
      accountInfo: { accountId, networkId, address: accountAddress } = {},
    } = (await this.getAccountsInfo(request))[0];

    let message = messages[0] as string;
    let address = messages[1] as string;

    // FIX: DYDX, KAVA evm use second param as message
    if (message?.toLowerCase() === accountAddress?.toLowerCase() && address) {
      [address, message] = messages;
    }
    message = autoFixPersonalSignMessage({ message });

    return this.backgroundApi.serviceDApp.openSignMessageModal({
      request,
      unsignedMessage: {
        type: EMessageTypesEth.PERSONAL_SIGN,
        message,
        payload: [message, address],
      },
      networkId: networkId ?? '',
      accountId: accountId ?? '',
    });
  }

  @providerApiMethod()
  async personal_ecRecover(
    request: IJsBridgeMessagePayload,
    ...messages: string[]
  ) {
    defaultLogger.discovery.dapp.dappRequest({ request });
    const [message, signature] = messages;
    if (
      typeof message === 'string' &&
      typeof signature === 'string' &&
      signature.length === 132
    ) {
      const result = await this._personalECRecover(
        { type: EMessageTypesEth.PERSONAL_SIGN, message },
        signature,
      );

      return result;
    }
    throw web3Errors.rpc.invalidParams(
      'personal_ecRecover requires a message and a 65 bytes signature.',
    );
  }

  @providerApiMethod()
  async metamask_logWeb3ShimUsage(request: IJsBridgeMessagePayload) {
    defaultLogger.discovery.dapp.dappRequestNotSupport({ request });
    throw web3Errors.rpc.methodNotSupported();
  }

  @providerApiMethod()
  async wallet_registerOnboarding(request: IJsBridgeMessagePayload) {
    defaultLogger.discovery.dapp.dappRequestNotSupport({ request });
    throw web3Errors.rpc.methodNotSupported();
  }

  @providerApiMethod()
  async wallet_scanQRCode(request: IJsBridgeMessagePayload) {
    defaultLogger.discovery.dapp.dappRequestNotSupport({ request });
    throw web3Errors.rpc.methodNotSupported();
  }

  @providerApiMethod()
  async wallet_getCapabilities(request: IJsBridgeMessagePayload) {
    defaultLogger.discovery.dapp.dappRequestNotSupport({ request });
    throw web3Errors.rpc.methodNotSupported();
  }

  @providerApiMethod()
  async wallet_sendCalls(request: IJsBridgeMessagePayload) {
    defaultLogger.discovery.dapp.dappRequestNotSupport({ request });
    throw web3Errors.rpc.methodNotSupported();
  }

  @providerApiMethod()
  async wallet_getCallsStatus(request: IJsBridgeMessagePayload) {
    defaultLogger.discovery.dapp.dappRequestNotSupport({ request });
    throw web3Errors.rpc.methodNotSupported();
  }

  @providerApiMethod()
  async wallet_showCallsStatus(request: IJsBridgeMessagePayload) {
    defaultLogger.discovery.dapp.dappRequestNotSupport({ request });
    throw web3Errors.rpc.methodNotSupported();
  }

  @providerApiMethod()
  async wallet_getSnaps(request: IJsBridgeMessagePayload) {
    defaultLogger.discovery.dapp.dappRequestNotSupport({ request });
    throw web3Errors.rpc.methodNotSupported();
  }

  @providerApiMethod()
  async eth_signTypedData(
    request: IJsBridgeMessagePayload,
    ...messages: any[]
  ) {
    defaultLogger.discovery.dapp.dappRequest({ request });
    const { accountInfo: { accountId, networkId } = {} } = (
      await this.getAccountsInfo(request)
    )[0];

    let message;
    if (messages.length && messages[0]) {
      message = messages[0] ?? null;
      if (
        await this._isValidAddress({
          networkId: networkId ?? '',
          address: message,
        })
      ) {
        message = messages[1] ?? null;
      }
    }

    let parsedData = message;
    try {
      parsedData = typeof message === 'string' && JSON.parse(message);
      // eslint-disable-next-line no-empty
    } catch {}

    const { types, primaryType, domain } = parsedData;
    let ethMessageType = EMessageTypesEth.TYPED_DATA_V1;
    if (typeof parsedData === 'object' && (types || primaryType || domain)) {
      ethMessageType = EMessageTypesEth.TYPED_DATA_V4;
    }

    // Convert to a JSON string
    let messageStr = message;
    if (typeof message === 'object') {
      messageStr = JSON.stringify(message);
    }

    return this.backgroundApi.serviceDApp.openSignMessageModal({
      request,
      unsignedMessage: {
        type: ethMessageType,
        message: messageStr,
        payload: messages,
      },
      networkId: networkId ?? '',
      accountId: accountId ?? '',
    });
  }

  @providerApiMethod()
  async eth_signTypedData_v1(
    request: IJsBridgeMessagePayload,
    ...messages: any[]
  ) {
    defaultLogger.discovery.dapp.dappRequest({ request });
    console.log('eth_signTypedData_v1', messages, request);
    return this.eth_signTypedData(request, ...messages);
  }

  @providerApiMethod()
  async eth_signTypedData_v3(
    request: IJsBridgeMessagePayload,
    ...messages: any[]
  ) {
    defaultLogger.discovery.dapp.dappRequest({ request });
    const { accountInfo: { accountId, networkId } = {} } = (
      await this.getAccountsInfo(request)
    )[0];
    console.log('eth_signTypedData_v3', messages, request);
    return this.backgroundApi.serviceDApp.openSignMessageModal({
      request,
      unsignedMessage: {
        type: EMessageTypesEth.TYPED_DATA_V3,
        message: messages[1],
        payload: messages,
      },
      networkId: networkId ?? '',
      accountId: accountId ?? '',
    });
  }

  @providerApiMethod()
  async eth_signTypedData_v4(
    request: IJsBridgeMessagePayload,
    ...messages: any[]
  ) {
    const isHyperLiquid = request.origin === HYPER_LIQUID_ORIGIN;
    let isHyperLiquidApproveAgentMessage = false;
    let hyperLiquidApproveAgentTypedData:
      | IHyperLiquidTypedDataApproveAgent
      | undefined;
    try {
      if (isHyperLiquid) {
        hyperLiquidApproveAgentTypedData = JSON.parse(
          messages?.[1],
        ) as IHyperLiquidTypedDataApproveAgent;
        isHyperLiquidApproveAgentMessage =
          hyperLiquidApproveAgentTypedData?.message?.type === 'approveAgent' &&
          hyperLiquidApproveAgentTypedData?.primaryType ===
            'HyperliquidTransaction:ApproveAgent';

        console.log(
          'hyperliquid——eth_signTypedData_v4',
          messages?.[0],
          hyperLiquidApproveAgentTypedData,
          isHyperLiquidApproveAgentMessage,
        );
      }
    } catch (e) {
      // eslint-disable-next-line no-empty
    }

    defaultLogger.discovery.dapp.dappRequest({ request });
    const { accountInfo: { accountId, networkId } = {} } = (
      await this.getAccountsInfo(request)
    )[0];
    console.log('eth_signTypedData_v4', messages, request);
    const result = await this.backgroundApi.serviceDApp.openSignMessageModal({
      request,
      unsignedMessage: {
        type: EMessageTypesEth.TYPED_DATA_V4,
        message: messages[1],
        payload: messages,
      },
      networkId: networkId ?? '',
      accountId: accountId ?? '',
    });

    return result;
  }

  ensureHyperLiquidOrigin(request: IJsBridgeMessagePayload) {
    if (request.origin !== HYPER_LIQUID_ORIGIN) {
      throw web3Errors.rpc.invalidRequest(
        `Unsupported origin: ${request.origin ?? 'unknown origin'}.`,
      );
    }
    if (
      !(request?.data as { '$$isOneKeyBuiltInPerpRequest': boolean })
        ?.$$isOneKeyBuiltInPerpRequest
    ) {
      throw web3Errors.rpc.invalidRequest(
        `Should be called by OneKey built in hyperliquid`,
      );
    }
  }

  @providerApiMethod()
  async hl_clearUserBuilderFeeCache(request: IJsBridgeMessagePayload) {
    this.ensureHyperLiquidOrigin(request);
    this.backgroundApi.serviceWebviewPerp.clearUserApprovedMaxBuilderCache();
  }

  @providerApiMethod()
  async hl_getBuilderFeeConfig(request: IJsBridgeMessagePayload) {
    this.ensureHyperLiquidOrigin(request);
    return this.backgroundApi.serviceWebviewPerp.getBuilderFeeConfig();
  }

  @providerApiMethod()
  async hl_checkUserStatus(
    request: IJsBridgeMessagePayload,
    {
      userAddress,
      chainId,
      shouldApproveBuilderFee,
    }: {
      userAddress: string;
      chainId: string;
      shouldApproveBuilderFee: boolean;
    },
  ) {
    this.ensureHyperLiquidOrigin(request);

    try {
      const status =
        await this.backgroundApi.serviceWebviewPerp.approveBuilderFeeIfRequired(
          {
            request,
            userAddress,
            chainId,
            skipApproveAction: !shouldApproveBuilderFee,
          },
        );
      return status;
    } catch (e) {
      void this.backgroundApi.serviceApp.showToast({
        method: 'error',
        title: (e as OneKeyError)?.message || 'Unknown error (1937542)',
      });
      throw e;
    }
  }

  @providerApiMethod()
  async hl_logApiEvent(
    request: IJsBridgeMessagePayload,
    {
      apiPayload,
      userAddress,
      chainId,
      errorMessage,
    }: {
      apiPayload: {
        action: { type: string };
        nonce: number;
      };
      userAddress: string;
      chainId: string;
      errorMessage?: string;
    },
  ) {
    this.ensureHyperLiquidOrigin(request);

    if (apiPayload?.action?.type === 'order') {
      const orderAction = apiPayload.action as {
        type: 'order';
        builder?: {
          b: string;
          f: number;
        };
        grouping?: string;
        orders?: object[];
      };
      defaultLogger.perp.common.placeOrder({
        userAddress,
        chainId,
        builderAddress: orderAction?.builder?.b ?? '',
        builderFee: orderAction?.builder?.f ?? 0,
        grouping: orderAction?.grouping ?? '',
        orders: orderAction?.orders ?? [],
        nonce: apiPayload?.nonce,
        errorMessage: errorMessage ?? '',
      });
    }
  }

  @providerApiMethod()
  async wallet_addEthereumChain(
    request: IJsBridgeMessagePayload,
    params: IAddEthereumChainParameter,
    address?: string,
    ...others: any[]
  ) {
    // some dapp will call methods many times, like https://beta.layer3.xyz/bounties/dca-into-mean

    // @ts-ignore
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    if (this._addEthereumChainMemo._has(request, params, address, ...others)) {
      /*
       code:-32002
       message:"Request of type 'wallet_addEthereumChain' already pending for origin https://beta.layer3.xyz. Please wait."
      */
      throw web3Errors.rpc.resourceUnavailable({
        message: `Request of type 'wallet_addEthereumChain' already pending for origin ${
          request?.origin || ''
        }. Please wait.`,
      });
    }

    // **** should await return
    await this._addEthereumChainMemo(request, params, address, ...others);

    // Metamask return null
    return null;
  }

  _addEthereumChainMemo = memoizee(
    async (
      request: IJsBridgeMessagePayload,
      params: IAddEthereumChainParameter,
      _address?: string,
      ..._others: any[]
    ) => {
      const networkId = `evm--${new BigNumber(params.chainId).toFixed()}`;
      const network = await this.backgroundApi.serviceNetwork.getNetworkSafe({
        networkId,
      });
      if (network) {
        const connectedAccount =
          await this.backgroundApi.serviceDApp.dAppGetConnectedAccountsInfo(
            request,
          );
        if (
          connectedAccount?.every(
            (account) => account.accountInfo?.networkId !== networkId,
          )
        ) {
          await this._switchEthereumChainMemo(request, {
            chainId: params.chainId,
          });
        }
        return convertToEthereumChainResult(network);
      }

      const result =
        await this.backgroundApi.serviceDApp.openAddCustomNetworkModal({
          request,
          params,
        });
      appEventBus.emit(EAppEventBusNames.OnSwitchDAppNetwork, {
        state: 'switching',
      });
      await timerUtils.wait(500);
      await this.wallet_switchEthereumChain(request, {
        chainId: params.chainId,
      });
      appEventBus.emit(EAppEventBusNames.OnSwitchDAppNetwork, {
        state: 'completed',
      });
      return convertToEthereumChainResult(result);
    },
    {
      max: 1,
      maxAge: 800,
      normalizer([request, params]: [
        IJsBridgeMessagePayload,
        ISwitchEthereumChainParameter,
      ]): string {
        const p = request?.data ?? [params];
        return stringify(p);
      },
    },
  );

  @providerApiMethod()
  async wallet_switchEthereumChain(
    request: IJsBridgeMessagePayload,
    params: ISwitchEthereumChainParameter,
  ) {
    defaultLogger.discovery.dapp.dappRequest({ request });
    // @ts-ignore
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    if (this._switchEthereumChainMemo._has(request, params)) {
      throw web3Errors.rpc.resourceUnavailable({
        message: `Request of type 'wallet_switchEthereumChain' already pending for origin ${
          request?.origin || ''
        }. Please wait.`,
      });
    }

    // some dapp will call methods many times, like https://beta.layer3.xyz/bounties/dca-into-mean
    // some dapp should wait this method response, like https://app.uniswap.org/#/swap
    // **** should await return
    await this._switchEthereumChainMemo(request, params);

    this.notifyNetworkChangedToDappSite(request.origin ?? '');
    setTimeout(() => {
      void this.backgroundApi.serviceDApp.notifyDAppChainChanged(
        request.origin ?? '',
      );
    }, 500);
    // Metamask return null
    return null;
  }

  /**
   * https://github.com/MetaMask/metamask-improvement-proposals/blob/main/MIPs/mip-2.md
   */
  @providerApiMethod()
  async wallet_revokePermissions(
    request: IJsBridgeMessagePayload,
    params: Record<string, unknown>,
  ) {
    defaultLogger.discovery.dapp.dappRequest({ request });
    if (get(params, 'eth_accounts', null) && request.origin) {
      await this.backgroundApi.serviceDApp.disconnectWebsite({
        origin: request.origin,
        storageType: 'injectedProvider',
      });
      return null;
    }

    throw web3Errors.rpc.invalidRequest('Unsupported permission type');
  }

  _switchEthereumChainMemo = memoizee(
    async (
      request: IJsBridgeMessagePayload,
      params: ISwitchEthereumChainParameter,
    ) => {
      const newNetworkId = `evm--${new BigNumber(params.chainId).toFixed()}`;
      const containsNetwork =
        await this.backgroundApi.serviceNetwork.containsNetwork({
          impls: [IMPL_EVM],
          networkId: newNetworkId,
        });
      if (!containsNetwork) {
        // https://uniswap-v3.scroll.io/#/swap required Error response
        throw web3Errors.provider.custom({
          code: 4902, // error code should be 4902 here
          message: `Unrecognized chain ID ${params.chainId}. Try adding the chain using wallet_addEthereumChain first.`,
        });
      }
      const accountsInfo =
        await this.backgroundApi.serviceDApp.dAppGetConnectedAccountsInfo(
          request,
        );
      if (!accountsInfo) {
        // if not found connected accounts, connect first
        await this.eth_requestAccounts(request);
      }

      const oldNetworkId = accountsInfo?.[0].accountInfo?.networkId;

      await this.backgroundApi.serviceDApp.switchConnectedNetwork({
        origin: request.origin ?? '',
        scope: request.scope ?? this.providerName,
        newNetworkId,
        oldNetworkId,
      });
    },
    {
      max: 1,
      maxAge: 800,
      normalizer([request, params]: [
        IJsBridgeMessagePayload,
        ISwitchEthereumChainParameter,
      ]): string {
        const p = request?.data ?? [params];
        return stringify(p);
      },
    },
  );

  _isValidAddress = async ({
    networkId,
    address,
  }: {
    networkId: string;
    address: string;
  }) => {
    try {
      const status = await this.backgroundApi.serviceValidator.validateAddress({
        networkId,
        address,
      });
      return status === 'valid';
    } catch {
      return false;
    }
  };

  _personalECRecover = async (
    message: {
      type: EMessageTypesEth;
      message: string;
    },
    signature: string,
  ) => {
    const messageHash = hashMessage({
      messageType: message.type,
      message: message.message,
    });
    const hashBuffer = ethUtils.toBuffer(messageHash);
    const sigBuffer = ethUtils.toBuffer(signature);
    check(hashBuffer.length === 32, 'Invalid message hash length');
    check(sigBuffer.length === 65, 'Invalid signature length');

    const [r, s, v] = [
      sigBuffer.subarray(0, 32),
      sigBuffer.subarray(32, 64),
      sigBuffer[64],
    ];
    const publicKey = ethUtils.ecrecover(hashBuffer, v, r, s);
    return ethUtils.addHexPrefix(
      ethUtils.pubToAddress(publicKey).toString('hex'),
    );
  };

  _getCurrentUnlockState = async () => Promise.resolve(true);
}

export default ProviderApiEthereum;
