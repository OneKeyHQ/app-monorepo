/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable camelcase */
import { fromB64 } from '@mysten/sui.js';
import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';

import { parseNetworkId } from '@onekeyhq/engine/src/managers/network';
import type VaultSUI from '@onekeyhq/engine/src/vaults/impl/sui/Vault';
import { getActiveWalletAccount } from '@onekeyhq/kit/src/hooks/redux';
import {
  backgroundClass,
  permissionRequired,
  providerApiMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { IMPL_SUI } from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import ProviderApiBase from './ProviderApiBase';

import type { IProviderBaseBackgroundNotifyInfo } from './ProviderApiBase';
import type {
  MoveCallTransaction,
  SignableTransaction,
  SuiAddress,
  SuiTransactionResponse,
} from '@mysten/sui.js';
import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';
import type {
  PermissionType,
  SuiChainType,
} from '@onekeyfe/onekey-sui-provider';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface SuiSignAndExecuteTransactionOptions {}

interface SuiSignAndExecuteTransactionInput {
  transaction: SignableTransaction;
  options?: SuiSignAndExecuteTransactionOptions;
}

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
    const data = () => {
      try {
        const params = this.network();
        const result = {
          method: 'wallet_events_networkChange',
          params,
        };
        return result;
      } catch (error) {
        return null;
      }
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

  @permissionRequired()
  @providerApiMethod()
  public getActiveChain(
    request: IJsBridgeMessagePayload,
  ): Promise<SuiChainType> {
    debugLogger.providerApi.info('SUI getActiveChain', request);
    return Promise.resolve(this.network());
  }

  private network(): SuiChainType {
    const { networkId } = getActiveWalletAccount();

    const { impl, chainId } = parseNetworkId(networkId);

    if (impl !== IMPL_SUI) {
      throw web3Errors.rpc.invalidRequest();
    }
    if (chainId === '8888881') {
      return 'sui:testnet';
    }
    if (chainId === '8888882') {
      return 'sui:devnet';
    }

    throw web3Errors.rpc.invalidRequest();
  }

  @permissionRequired()
  @providerApiMethod()
  public async signAndExecuteTransaction(
    request: IJsBridgeMessagePayload,
    params: SuiSignAndExecuteTransactionInput,
  ): Promise<SuiTransactionResponse> {
    debugLogger.providerApi.info('SUI signAndSubmitTransaction', params);
    const { networkId, accountId } = getActiveWalletAccount();
    const vault = (await this.backgroundApi.engine.getVault({
      networkId,
      accountId,
    })) as VaultSUI;

    const encodeTx = params.transaction;

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

    const data = typeof params === 'string' ? fromB64(params) : params;

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
