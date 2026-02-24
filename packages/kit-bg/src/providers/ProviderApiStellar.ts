/* eslint-disable camelcase */
import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';

import type { IEncodedTxStellar } from '@onekeyhq/core/src/chains/stellar/types';
import {
  backgroundClass,
  providerApiMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { NotImplemented } from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';
import { EMessageTypesStellar } from '@onekeyhq/shared/types/message';

import { vaultFactory } from '../vaults/factory';

import ProviderApiBase from './ProviderApiBase';

import type { IProviderBaseBackgroundNotifyInfo } from './ProviderApiBase';
import type Vault from '../vaults/impls/stellar/Vault';
import type {
  IJsBridgeMessagePayload,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';

type IGetAddressParams = {
  path?: string;
  skipRequestAccess?: boolean;
};

type IGetAddressResult = {
  address: string;
};

type ISignTransactionParams = {
  xdr: string;
  networkPassphrase?: string;
  address?: string;
  path?: string;
  submit?: boolean;
  submitUrl?: string;
};

type ISignTransactionResult = {
  signedTxXdr: string;
  signerAddress?: string;
};

type ISignAuthEntryParams = {
  authEntry: string;
  networkPassphrase?: string;
  address?: string;
  path?: string;
};

type ISignAuthEntryResult = {
  signedAuthEntry: string;
  signerAddress?: string;
};

type ISignMessageParams = {
  message: string;
  networkPassphrase?: string;
  address?: string;
  path?: string;
};

type ISignMessageResult = {
  signedMessage: string;
  signerAddress?: string;
};

type IGetNetworkResult = {
  network: string;
  networkPassphrase: string;
};

@backgroundClass()
class ProviderApiStellar extends ProviderApiBase {
  public providerName = IInjectedProviderNames.stellar;

  private _getConnectedAccountsAddress = async (
    request: IJsBridgeMessagePayload,
  ): Promise<string | undefined> => {
    const accountsInfo =
      await this.backgroundApi.serviceDApp.dAppGetConnectedAccountsInfo(
        request,
      );
    if (!accountsInfo || accountsInfo.length === 0) {
      return undefined;
    }
    return accountsInfo[0]?.account?.address;
  };

  notifyDappAccountsChanged(info: IProviderBaseBackgroundNotifyInfo): void {
    const data = async ({ origin }: { origin: string }) => {
      const address = await this._getConnectedAccountsAddress({
        origin,
        scope: this.providerName,
      });
      const result = {
        method: 'wallet_events_accountsChanged',
        params: address,
      };
      return result;
    };
    info.send(data, info.targetOrigin);
  }

  notifyDappChainChanged(_info: IProviderBaseBackgroundNotifyInfo): void {
    // Stellar doesn't have chain changed events like EVM chains
    // Network changes are handled differently
  }

  public async rpcCall(request: IJsBridgeMessagePayload): Promise<any> {
    const { data } = request;
    const { accountInfo: { networkId } = {} } = (
      await this.getAccountsInfo(request)
    )[0];
    const rpcRequest = data as IJsonRpcRequest;

    console.log(`${this.providerName} RpcCall=====>>>> : BgApi:`, request);

    const [result] = await this.backgroundApi.serviceDApp.proxyRPCCall({
      networkId: networkId ?? '',
      request: rpcRequest,
      origin: request.origin ?? '',
    });

    return result;
  }

  // ----------------------------------------------

  @providerApiMethod()
  async stellar_getAddress(
    request: IJsBridgeMessagePayload,
    params?: IGetAddressParams,
  ): Promise<IGetAddressResult> {
    defaultLogger.discovery.dapp.dappRequest({ request });

    const { skipRequestAccess = false } = params || {};

    // Check if already connected
    let address = await this._getConnectedAccountsAddress(request);

    // If not connected and not skipping request access, open connection modal
    if (!address && !skipRequestAccess) {
      await this.backgroundApi.serviceDApp.openConnectionModal(request);
      address = await this._getConnectedAccountsAddress(request);
    }

    if (!address) {
      throw web3Errors.provider.unauthorized(
        'No connected account. Please connect your wallet first.',
      );
    }

    return { address };
  }

  @providerApiMethod()
  async stellar_signTransaction(
    request: IJsBridgeMessagePayload,
    params: ISignTransactionParams,
  ): Promise<ISignTransactionResult> {
    defaultLogger.discovery.dapp.dappRequest({ request });

    const { xdr, networkPassphrase, submit = false } = params;

    if (!xdr) {
      throw web3Errors.rpc.invalidParams('Transaction XDR is required');
    }

    const { accountInfo: { accountId, networkId, address } = {} } = (
      await this.getAccountsInfo(request)
    )[0];

    // Get network passphrase from params or derive from Vault context
    let resolvedNetworkPassphrase = networkPassphrase;
    if (!resolvedNetworkPassphrase && networkId && accountId) {
      const vault = (await vaultFactory.getVault({
        networkId,
        accountId,
      })) as Vault;
      resolvedNetworkPassphrase = await vault.getNetworkPassphrase();
    }

    // Prepare encoded transaction with Stellar-specific data
    const encodedTx = {
      xdr,
      networkPassphrase: resolvedNetworkPassphrase,
      isFromDapp: true,
    } as IEncodedTxStellar;

    if (submit) {
      // Sign and send transaction
      const result =
        await this.backgroundApi.serviceDApp.openSignAndSendTransactionModal({
          request,
          encodedTx,
          accountId: accountId ?? '',
          networkId: networkId ?? '',
          signOnly: false,
        });

      return {
        signedTxXdr: result.rawTx,
        signerAddress: address,
      };
    }

    // Sign only
    const result =
      await this.backgroundApi.serviceDApp.openSignAndSendTransactionModal({
        request,
        encodedTx,
        accountId: accountId ?? '',
        networkId: networkId ?? '',
        signOnly: true,
      });

    return {
      signedTxXdr: result.rawTx,
      signerAddress: address,
    };
  }

  @providerApiMethod()
  async stellar_signAuthEntry(
    _request: IJsBridgeMessagePayload,
    _params: ISignAuthEntryParams,
  ): Promise<ISignAuthEntryResult> {
    throw new NotImplemented();
    // defaultLogger.discovery.dapp.dappRequest({ request });
    // const { authEntry, networkPassphrase } = params;
    // if (!authEntry) {
    //   throw web3Errors.rpc.invalidParams('AuthEntry XDR is required');
    // }
    // const { accountInfo: { accountId, networkId, address } = {} } = (
    //   await this.getAccountsInfo(request)
    // )[0];
    // let resolvedNetworkPassphrase = networkPassphrase;
    // if (!resolvedNetworkPassphrase) {
    //   resolvedNetworkPassphrase = getNetworkPassphrase(networkId ?? '');
    // }
    // const result = (await this.backgroundApi.serviceDApp.openSignMessageModal({
    //   request,
    //   unsignedMessage: {
    //     type: EMessageTypesStellar.SIGN_AUTH_ENTRY,
    //     message: authEntry,
    //     payload: {
    //       networkPassphrase: resolvedNetworkPassphrase,
    //     },
    //   },
    //   accountId: accountId ?? '',
    //   networkId: networkId ?? '',
    // })) as string;
    // return {
    //   signedAuthEntry: result,
    //   signerAddress: address,
    // };
  }

  @providerApiMethod()
  async stellar_signMessage(
    request: IJsBridgeMessagePayload,
    params: ISignMessageParams,
  ): Promise<ISignMessageResult> {
    defaultLogger.discovery.dapp.dappRequest({ request });

    const { message } = params;

    if (!message) {
      throw web3Errors.rpc.invalidParams('Message is required');
    }

    const { accountInfo: { accountId, networkId, address } = {} } = (
      await this.getAccountsInfo(request)
    )[0];

    const result = (await this.backgroundApi.serviceDApp.openSignMessageModal({
      request,
      unsignedMessage: {
        type: EMessageTypesStellar.SIGN_MESSAGE,
        message,
      },
      accountId: accountId ?? '',
      networkId: networkId ?? '',
    })) as string;

    return {
      signedMessage: bufferUtils.bytesToBase64(
        bufferUtils.hexToBytes(hexUtils.stripHexPrefix(result)),
      ),
      signerAddress: address,
    };
  }

  @providerApiMethod()
  async stellar_getNetwork(
    request: IJsBridgeMessagePayload,
  ): Promise<IGetNetworkResult> {
    defaultLogger.discovery.dapp.dappRequest({ request });

    const networks =
      await this.backgroundApi.serviceDApp.getConnectedNetworks(request);

    if (!networks || networks.length === 0) {
      throw web3Errors.provider.unauthorized('No network connected');
    }

    const network = networks[0];

    // Map network to Stellar network names
    const networkName = network.isTestnet ? 'testnet' : 'mainnet';
    const networkPassphrase = network.isTestnet
      ? 'Test SDF Network ; September 2015'
      : 'Public Global Stellar Network ; September 2015';

    return {
      network: networkName,
      networkPassphrase,
    };
  }

  @providerApiMethod()
  async stellar_disconnect(request: IJsBridgeMessagePayload): Promise<void> {
    defaultLogger.discovery.dapp.dappRequest({ request });

    const { origin } = request;
    if (!origin) {
      return;
    }

    await this.backgroundApi.serviceDApp.disconnectWebsite({
      origin,
      storageType: 'injectedProvider',
    });
  }
}

export default ProviderApiStellar;
