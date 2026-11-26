/* eslint-disable camelcase */
import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';

import {
  normalizeStarknetChainId,
  tryNormalizeStarknetChainId,
} from '@onekeyhq/core/src/chains/starknet/sdkStarknet/chainId';
import type { IStarknetCall } from '@onekeyhq/core/src/chains/starknet/types';
import {
  backgroundClass,
  providerApiMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import { EMessageTypesStarknet } from '@onekeyhq/shared/types/message';

import { vaultFactory } from '../vaults/factory';
import {
  normalizeStarknetAddress,
  toHexFelt,
} from '../vaults/impls/starknet/utils';

import ProviderApiBase from './ProviderApiBase';

import type { IProviderBaseBackgroundNotifyInfo } from './ProviderApiBase';
import type StarknetVault from '../vaults/impls/starknet/Vault';
import type {
  IInjectedProviderNames,
  IJsBridgeMessagePayload,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';

const STARKNET_PROVIDER_NAME = 'starknet' as IInjectedProviderNames;
const STARKNET_MAINNET_CHAIN_ID = '0x534e5f4d41494e';
const STARKNET_SEPOLIA_CHAIN_ID = '0x534e5f5345504f4c4941';
const SUPPORTED_WALLET_API_VERSIONS = ['0.7', '0.8'];
const SUPPORTED_RPC_SPECS = ['0.7', '0.8', '0.9'];

function starknetWalletError(
  code: number,
  message: string,
): Error & { code: number } {
  const error = new Error(message) as Error & { code: number };
  error.code = code;
  return error;
}

function redactDappRequestForLog(request: IJsBridgeMessagePayload) {
  const rpc = request.data as IJsonRpcRequest | undefined;
  return {
    origin: request.origin,
    scope: request.scope,
    method: rpc?.method,
  };
}

type IRequestAccountsParams = {
  silent_mode?: boolean;
};

type ISwitchStarknetChainParams = {
  chainId: string;
};

type IStarknetDappCall = {
  contract_address: string;
  entry_point: string;
  calldata?: string[];
};

type IAddInvokeTransactionParams = {
  calls: IStarknetDappCall[];
};

function mapStarknetChainIdToNetworkId(chainId: string): string | undefined {
  const normalized = tryNormalizeStarknetChainId(chainId);
  if (normalized === STARKNET_MAINNET_CHAIN_ID) {
    return 'starknet--mainnet';
  }
  if (normalized === STARKNET_SEPOLIA_CHAIN_ID) {
    return 'starknet--sepolia';
  }
  return undefined;
}

@backgroundClass()
class ProviderApiStarknet extends ProviderApiBase {
  public providerName = STARKNET_PROVIDER_NAME;

  private async _getConnectedAccountInfo(request: IJsBridgeMessagePayload) {
    const accountsInfo =
      await this.backgroundApi.serviceDApp.dAppGetConnectedAccountsInfo(
        request,
      );
    return accountsInfo?.[0];
  }

  private async _getConnectedAddress(
    request: IJsBridgeMessagePayload,
  ): Promise<string | undefined> {
    const connected = await this._getConnectedAccountInfo(request);
    return connected?.account?.address;
  }

  private async _resolveChainIdHex(networkId?: string): Promise<string> {
    if (!networkId) {
      return STARKNET_MAINNET_CHAIN_ID;
    }
    try {
      const network = await this.backgroundApi.serviceNetwork.getNetwork({
        networkId,
      });
      return normalizeStarknetChainId(network.chainId);
    } catch {
      return networkId === 'starknet--sepolia'
        ? STARKNET_SEPOLIA_CHAIN_ID
        : STARKNET_MAINNET_CHAIN_ID;
    }
  }

  notifyDappAccountsChanged(info: IProviderBaseBackgroundNotifyInfo): void {
    const data = async ({ origin }: { origin: string }) => {
      const address = await this._getConnectedAddress({
        origin,
        scope: this.providerName,
      });
      return {
        method: 'wallet_events_accountsChanged',
        params: address ? [address] : [],
      };
    };
    info.send(data, info.targetOrigin);
  }

  notifyDappChainChanged(info: IProviderBaseBackgroundNotifyInfo): void {
    const data = async ({ origin }: { origin: string }) => {
      const connected = await this._getConnectedAccountInfo({
        origin,
        scope: this.providerName,
      });
      const chainId = await this._resolveChainIdHex(
        connected?.accountInfo?.networkId,
      );
      const address = connected?.account?.address;
      return {
        method: 'wallet_events_networkChanged',
        params: {
          chainId,
          accounts: address ? [address] : [],
        },
      };
    };
    info.send(data, info.targetOrigin);
  }

  public async rpcCall(request: IJsBridgeMessagePayload): Promise<unknown> {
    const { data } = request;
    const { accountInfo: { networkId } = {} } = (
      await this.getAccountsInfo(request)
    )[0];
    const rpcRequest = data as IJsonRpcRequest;
    const [result] = await this.backgroundApi.serviceDApp.proxyRPCCall({
      networkId: networkId ?? '',
      request: rpcRequest,
      origin: request.origin ?? '',
    });
    return result;
  }

  @providerApiMethod()
  async wallet_supportedWalletApi(): Promise<string[]> {
    return [...SUPPORTED_WALLET_API_VERSIONS];
  }

  @providerApiMethod()
  async wallet_supportedSpecs(): Promise<string[]> {
    return [...SUPPORTED_RPC_SPECS];
  }

  @providerApiMethod()
  async wallet_getPermissions(
    request: IJsBridgeMessagePayload,
  ): Promise<string[]> {
    const address = await this._getConnectedAddress(request);
    return address ? ['accounts'] : [];
  }

  @providerApiMethod()
  async wallet_requestAccounts(
    request: IJsBridgeMessagePayload,
    params?: IRequestAccountsParams,
  ): Promise<string[]> {
    defaultLogger.discovery.dapp.dappRequest({
      request: redactDappRequestForLog(request),
    });
    let address = await this._getConnectedAddress(request);
    if (!address && !params?.silent_mode) {
      await this.backgroundApi.serviceDApp.openConnectionModal(request);
      address = await this._getConnectedAddress(request);
    }
    return address ? [address] : [];
  }

  @providerApiMethod()
  async wallet_requestChainId(
    request: IJsBridgeMessagePayload,
  ): Promise<string> {
    const connected = await this._getConnectedAccountInfo(request);
    return this._resolveChainIdHex(connected?.accountInfo?.networkId);
  }

  @providerApiMethod()
  async wallet_switchStarknetChain(
    request: IJsBridgeMessagePayload,
    params?: ISwitchStarknetChainParams,
  ): Promise<boolean> {
    defaultLogger.discovery.dapp.dappRequest({
      request: redactDappRequestForLog(request),
    });
    const targetChainId = params?.chainId;
    if (!targetChainId || typeof targetChainId !== 'string') {
      throw web3Errors.rpc.invalidParams('chainId is required');
    }
    const newNetworkId = mapStarknetChainIdToNetworkId(targetChainId);
    if (!newNetworkId) {
      throw starknetWalletError(
        112,
        `Unrecognized Starknet chainId: ${targetChainId}`,
      );
    }
    const connected = await this._getConnectedAccountInfo(request);
    if (!connected) {
      await this.wallet_requestAccounts(request);
    }
    await this.backgroundApi.serviceDApp.switchConnectedNetwork({
      origin: request.origin ?? '',
      scope: request.scope ?? this.providerName,
      oldNetworkId: connected?.accountInfo?.networkId,
      newNetworkId,
    });
    return true;
  }

  @providerApiMethod()
  async wallet_deploymentData(request: IJsBridgeMessagePayload) {
    defaultLogger.discovery.dapp.dappRequest({
      request: redactDappRequestForLog(request),
    });
    const { accountInfo: { accountId, networkId } = {} } = (
      await this.getAccountsInfo(request)
    )[0];
    if (!accountId || !networkId) {
      throw web3Errors.provider.unauthorized();
    }
    const vault = (await vaultFactory.getVault({
      networkId,
      accountId,
    })) as StarknetVault;
    const deploymentData = await vault.getAccountDeploymentData();
    if (!deploymentData) {
      throw starknetWalletError(115, 'Account is already deployed');
    }
    return deploymentData;
  }

  @providerApiMethod()
  async wallet_addInvokeTransaction(
    request: IJsBridgeMessagePayload,
    params?: IAddInvokeTransactionParams,
  ): Promise<{ transaction_hash: string }> {
    defaultLogger.discovery.dapp.dappRequest({
      request: redactDappRequestForLog(request),
    });
    if (!params?.calls?.length || !Array.isArray(params.calls)) {
      throw web3Errors.rpc.invalidParams('calls array is required');
    }
    const { accountInfo: { accountId, networkId } = {} } = (
      await this.getAccountsInfo(request)
    )[0];
    if (!accountId || !networkId) {
      throw web3Errors.provider.unauthorized();
    }

    const calls: IStarknetCall[] = params.calls.map((call) => {
      if (!call?.contract_address || !call?.entry_point) {
        throw web3Errors.rpc.invalidParams(
          'Each call requires contract_address and entry_point',
        );
      }
      return {
        contractAddress: normalizeStarknetAddress(call.contract_address),
        entrypoint: call.entry_point,
        calldata: (call.calldata ?? []).map((item) => toHexFelt(item)),
      };
    });

    const vault = (await vaultFactory.getVault({
      networkId,
      accountId,
    })) as StarknetVault;
    const encodedTx = await vault.buildDappInvokeEncodedTx({ calls });

    const result =
      await this.backgroundApi.serviceDApp.openSignAndSendTransactionModal({
        request,
        encodedTx,
        accountId,
        networkId,
        signOnly: false,
      });

    return {
      transaction_hash: result.txid,
    };
  }

  @providerApiMethod()
  async wallet_signTypedData(
    request: IJsBridgeMessagePayload,
    params?: Record<string, unknown>,
  ): Promise<string[]> {
    defaultLogger.discovery.dapp.dappRequest({
      request: redactDappRequestForLog(request),
    });
    if (!params || typeof params !== 'object') {
      throw web3Errors.rpc.invalidParams('TypedData object is required');
    }
    const { accountInfo: { accountId, networkId } = {} } = (
      await this.getAccountsInfo(request)
    )[0];
    if (!accountId || !networkId) {
      throw web3Errors.provider.unauthorized();
    }

    const domain =
      params.domain && typeof params.domain === 'object'
        ? (params.domain as { chainId?: unknown })
        : undefined;
    const rawDomainChainId = domain?.chainId;
    if (
      typeof rawDomainChainId === 'string' ||
      typeof rawDomainChainId === 'number' ||
      typeof rawDomainChainId === 'bigint'
    ) {
      const normalizedDomainChainId = tryNormalizeStarknetChainId(
        String(rawDomainChainId),
      );
      const network = await this.backgroundApi.serviceNetwork.getNetwork({
        networkId,
      });
      const expectedChainId = normalizeStarknetChainId(network.chainId);
      if (
        !normalizedDomainChainId ||
        normalizedDomainChainId !== expectedChainId
      ) {
        throw web3Errors.rpc.invalidParams(
          'TypedData domain chainId does not match the connected Starknet network',
        );
      }
    }

    const signed = (await this.backgroundApi.serviceDApp.openSignMessageModal({
      request,
      unsignedMessage: {
        type: EMessageTypesStarknet.SIGN_TYPED_DATA,
        message: stringUtils.stableStringify(params),
      },
      accountId,
      networkId,
    })) as string;

    const parsed = JSON.parse(signed) as unknown;
    if (!Array.isArray(parsed)) {
      throw web3Errors.rpc.internal('Invalid Starknet signature format');
    }
    return parsed.map((item) => String(item));
  }
}

export default ProviderApiStarknet;
