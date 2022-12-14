/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable camelcase */
import { Base64DataBuffer } from '@mysten/sui.js';
import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import {
  IInjectedProviderNames,
  IJsBridgeMessagePayload,
} from '@onekeyfe/cross-inpage-provider-types';
import { PermissionType } from '@onekeyfe/onekey-sui-provider';

import VaultSUI from '@onekeyhq/engine/src/vaults/impl/sui/Vault';
import { getActiveWalletAccount } from '@onekeyhq/kit/src/hooks/redux';
import {
  backgroundClass,
  permissionRequired,
  providerApiMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { IMPL_SUI } from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import ProviderApiBase, {
  IProviderBaseBackgroundNotifyInfo,
} from './ProviderApiBase';

import type {
  MoveCallTransaction,
  SignableTransaction,
  SuiAddress,
  SuiTransactionResponse,
} from '@mysten/sui.js';

@backgroundClass()
class ProviderApiSui extends ProviderApiBase {
  public providerName = IInjectedProviderNames.sui;

  public notifyDappAccountsChanged(info: IProviderBaseBackgroundNotifyInfo) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const data = async ({ origin }: { origin: string }) => {
      const params = await this.account({ origin });
      const result = {
        method: 'wallet_events_accountChanged',
        params,
      };
      return result;
    };
    info.send(data);
  }

  public notifyDappChainChanged(info: IProviderBaseBackgroundNotifyInfo) {
    const data = async () => {
      const params = await this.network();
      const result = {
        // TODO do not emit events to EVM Dapps, injected provider check scope
        method: 'wallet_events_networkChange',
        params,
      };
      return result;
    };
    info.send(data);
  }

  public rpcCall() {
    throw web3Errors.rpc.methodNotSupported();
  }

  @providerApiMethod()
  public async hasPermissions(
    request: IJsBridgeMessagePayload,
    params: {
      permissions: readonly PermissionType[];
    },
  ): Promise<boolean> {
    debugLogger.providerApi.info('SUI hasPermissions', request, params);
    // const permissions =
    //   params.permissions.length === 0
    //     ? ALL_PERMISSION_TYPES
    //     : params.permissions;

    return !!(await this.account(request));
  }

  @providerApiMethod()
  public async requestPermissions(
    request: IJsBridgeMessagePayload,
    params: {
      permissions: readonly PermissionType[];
    },
  ): Promise<boolean> {
    debugLogger.providerApi.info('SUI requestPermissions', request, params);
    // const permissions =
    //   params.permissions.length === 0
    //     ? ALL_PERMISSION_TYPES
    //     : params.permissions;

    const account = await this.account(request);
    if (account) {
      return true;
    }
    await this.backgroundApi.serviceDapp.openConnectionModal(request);
    return !!(await this.account(request));
  }

  @permissionRequired()
  @providerApiMethod()
  public async getAccounts(
    request: IJsBridgeMessagePayload,
  ): Promise<SuiAddress[]> {
    debugLogger.providerApi.info('SUI getAccounts', request);
    let account = await this.account(request);

    if (account) {
      return [account];
    }

    await this.backgroundApi.serviceDapp.openConnectionModal(request);

    account = await this.account(request);
    if (account) {
      return [account];
    }
    return [];
  }

  @providerApiMethod()
  public disconnect(request: IJsBridgeMessagePayload) {
    const { origin } = request;
    if (!origin) {
      return;
    }
    this.backgroundApi.serviceDapp.removeConnectedAccounts({
      origin,
      networkImpl: IMPL_SUI,
      addresses: this.backgroundApi.serviceDapp
        .getActiveConnectedAccounts({ origin, impl: IMPL_SUI })
        .map(({ address }) => address),
    });
    debugLogger.providerApi.info('SUI disconnect', origin);
  }

  private async account(
    request: IJsBridgeMessagePayload,
  ): Promise<string | undefined> {
    debugLogger.providerApi.info('SUI account');
    const { networkId, networkImpl, accountId } = getActiveWalletAccount();
    if (networkImpl !== IMPL_SUI) {
      return undefined;
    }

    const connectedAccounts =
      this.backgroundApi.serviceDapp?.getActiveConnectedAccounts({
        origin: request.origin as string,
        impl: IMPL_SUI,
      });
    if (!connectedAccounts) {
      return undefined;
    }

    const vault = (await this.backgroundApi.engine.getVault({
      networkId,
      accountId,
    })) as VaultSUI;
    const address = await vault.getAccountAddress();

    const addresses = connectedAccounts.map((account) => account.address);
    if (!addresses.includes(address)) {
      return undefined;
    }

    return Promise.resolve(address);
  }

  private async network(): Promise<string> {
    debugLogger.providerApi.info('SUI network');
    const { networkId } = getActiveWalletAccount();
    const network = await this.backgroundApi.engine.getNetwork(networkId);

    return Promise.resolve(network.isTestnet ? 'Testnet' : 'Mainnet');
  }

  @permissionRequired()
  @providerApiMethod()
  public async signAndExecuteTransaction(
    request: IJsBridgeMessagePayload,
    params: SignableTransaction,
  ): Promise<SuiTransactionResponse> {
    debugLogger.providerApi.info('SUI signAndSubmitTransaction', params);
    const { networkId, accountId } = getActiveWalletAccount();
    const vault = (await this.backgroundApi.engine.getVault({
      networkId,
      accountId,
    })) as VaultSUI;

    const encodeTx = params;

    const result = (await this.backgroundApi.serviceDapp.openSignAndSendModal(
      request,
      { encodedTx: encodeTx },
    )) as string;

    const tx = await vault.getTransactionByTxId(result);

    if (!tx) throw new Error('Transaction not found');

    return Promise.resolve(tx);
  }

  @permissionRequired()
  @providerApiMethod()
  public async executeMoveCall(
    request: IJsBridgeMessagePayload,
    params: MoveCallTransaction,
  ) {
    debugLogger.providerApi.info('SUI executeMoveCall', params);

    const { networkId, accountId } = getActiveWalletAccount();
    const vault = (await this.backgroundApi.engine.getVault({
      networkId,
      accountId,
    })) as VaultSUI;

    const result = (await this.backgroundApi.serviceDapp.openSignAndSendModal(
      request,
      {
        encodedTx: {
          kind: 'moveCall',
          data: params,
        },
      },
    )) as string;

    const tx = await vault.getTransactionByTxId(result);

    if (!tx) throw new Error('Transaction not found');

    return Promise.resolve(tx);
  }

  @permissionRequired()
  @providerApiMethod()
  public async executeSerializedMoveCall(
    request: IJsBridgeMessagePayload,
    params: string | Uint8Array,
  ) {
    debugLogger.providerApi.info('SUI executeSerializedMoveCall', params);

    const { networkId, accountId } = getActiveWalletAccount();
    const vault = (await this.backgroundApi.engine.getVault({
      networkId,
      accountId,
    })) as VaultSUI;

    const data =
      typeof params === 'string'
        ? new Base64DataBuffer(params).getData()
        : params;

    const result = (await this.backgroundApi.serviceDapp.openSignAndSendModal(
      request,
      {
        encodedTx: {
          kind: 'bytes',
          data,
        },
      },
    )) as string;

    const tx = await vault.getTransactionByTxId(result);

    if (!tx) throw new Error('Transaction not found');

    return Promise.resolve(tx);
  }
}

export default ProviderApiSui;
