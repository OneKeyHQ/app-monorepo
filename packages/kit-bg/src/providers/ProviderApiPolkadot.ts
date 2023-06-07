/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable camelcase */
import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';

import type { CommonMessage } from '@onekeyhq/engine/src/types/message';
import { CommonMessageTypes } from '@onekeyhq/engine/src/types/message';
import polkadotSdk from '@onekeyhq/engine/src/vaults/impl/dot/sdk/polkadotSdk';
import type {
  InjectedAccount,
  SignerPayloadJSON,
  SignerPayloadRaw,
} from '@onekeyhq/engine/src/vaults/impl/dot/sdk/polkadotSdkTypes';
import type { IEncodedTxDot } from '@onekeyhq/engine/src/vaults/impl/dot/types';
import type VaultDot from '@onekeyhq/engine/src/vaults/impl/dot/Vault';
import type { ISignedTxPro } from '@onekeyhq/engine/src/vaults/types';
import { getActiveWalletAccount } from '@onekeyhq/kit/src/hooks/redux';
import {
  backgroundClass,
  permissionRequired,
  providerApiMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { IMPL_DOT } from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import ProviderApiBase from './ProviderApiBase';

import type { IProviderBaseBackgroundNotifyInfo } from './ProviderApiBase';
import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

const { decodeAddress, encodeAddress } = polkadotSdk;

export interface RequestRpcSend {
  method: string;
  params: unknown[];
}

export interface RequestRpcSubscribe extends RequestRpcSend {
  type: string;
}

export interface RequestRpcUnsubscribe {
  type: string;
  method: string;
  id: string;
}

export interface SignerResult {
  /**
   * @description The id for this request
   */
  id: number;

  /**
   * @description The resulting signature in hex
   */
  signature: string;
}

@backgroundClass()
class ProviderApiPolkadot extends ProviderApiBase {
  public providerName = IInjectedProviderNames.polkadot;

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
      const { networkId } = getActiveWalletAccount();
      const result = {
        // TODO do not emit events to EVM Dapps, injected provider check scope
        method: 'wallet_events_networkChange',
        params: networkId,
      };
      return result;
    };
    info.send(data);
  }

  public rpcCall() {
    throw web3Errors.rpc.methodNotSupported();
  }

  @providerApiMethod()
  public async web3Enable(
    request: IJsBridgeMessagePayload,
    params: string,
  ): Promise<boolean> {
    debugLogger.providerApi.info('Polkadot web3Enable', request, params);

    if (await this.account(request, params)) {
      return true;
    }

    const [address] = (await this.backgroundApi.serviceDapp.openConnectionModal(
      request,
    )) as string[];

    return !!address;
  }

  @permissionRequired()
  @providerApiMethod()
  public async web3Accounts(
    request: IJsBridgeMessagePayload,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    params: boolean,
  ): Promise<InjectedAccount[]> {
    debugLogger.providerApi.info('Polkadot getAccounts', request);
    let account = await this.account(request);

    if (account) {
      return [
        {
          address: account.address,
          genesisHash: null,
          name: account.name,
          type: 'ed25519',
        },
      ];
    }

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
      networkImpl: IMPL_DOT,
      addresses: this.backgroundApi.serviceDapp
        .getActiveConnectedAccounts({ origin, impl: IMPL_DOT })
        .map(({ address }) => address),
    });
    debugLogger.providerApi.info('Polkadot disconnect', origin);
  }

  private async account(
    request: IJsBridgeMessagePayload,
    dappName?: string,
  ): Promise<
    | {
        address: string;
        name: string;
      }
    | undefined
  > {
    debugLogger.providerApi.info('Polkadot account');
    const { networkId, networkImpl, accountId } = getActiveWalletAccount();
    if (networkImpl !== IMPL_DOT) {
      return undefined;
    }

    const connectedAccounts =
      this.backgroundApi.serviceDapp?.getActiveConnectedAccounts({
        origin: request.origin ?? dappName ?? '',
        impl: IMPL_DOT,
      });

    if (!connectedAccounts || !connectedAccounts.length) {
      return undefined;
    }

    const vault = (await this.backgroundApi.engine.getVault({
      networkId,
      accountId,
    })) as VaultDot;
    const address = await vault.getAccountAddress();
    const dbAccount = await vault.getDbAccount();

    const addresses = connectedAccounts.map((account) => account.address);
    if (!addresses.includes(address)) {
      return undefined;
    }

    debugLogger.providerApi.info('Polkadot account:', {
      address,
      name: dbAccount.name,
    });

    return Promise.resolve({
      address,
      name: dbAccount.name,
    });
  }

  private async findAccount(
    walletId: string,
    networkId: string,
    address: string,
  ) {
    const wallet = await this.backgroundApi.engine.getWalletSafe(walletId);

    if (!wallet)
      throw web3Errors.provider.custom({
        code: 4001,
        message: 'Wallet not found',
      });

    const accounts = await this.backgroundApi.engine.getAccounts(
      wallet.accounts,
      networkId,
    );

    const selectAccount = accounts.find((account) => {
      if (account.address === address) {
        return account;
      }

      const normalAddress =
        account.address.length === 42
          ? account.address
          : encodeAddress(decodeAddress(account.address));

      if (normalAddress === address) {
        return account;
      }
      return undefined;
    });

    if (!selectAccount)
      throw web3Errors.provider.custom({
        code: 4002,
        message: 'Account not found',
      });

    return selectAccount;
  }

  @permissionRequired()
  @providerApiMethod()
  public async web3SignPayload(
    request: IJsBridgeMessagePayload,
    params: SignerPayloadJSON,
  ): Promise<SignerResult> {
    debugLogger.providerApi.info('Polkadot signAndSubmitTransaction', params);

    const { walletId, networkId, accountId } = getActiveWalletAccount();
    const selectAccount = await this.findAccount(
      walletId,
      networkId,
      params.address,
    );

    if (selectAccount.id !== accountId) {
      throw web3Errors.provider.custom({
        code: 4003,
        message: 'Account not match',
      });
    }

    const vault = (await this.backgroundApi.engine.getChainOnlyVault(
      networkId,
    )) as VaultDot;

    const metadata = await vault.getMetadataRpcCache();

    const encodeTx: IEncodedTxDot = {
      ...params,
      metadataRpc: metadata.toHex(),
    };

    const result = (await this.backgroundApi.serviceDapp.openSignAndSendModal(
      request,
      { encodedTx: encodeTx, signOnly: true },
    )) as ISignedTxPro;

    return Promise.resolve({
      id: request.id ?? 0,
      signature: result.signature ?? '',
    });
  }

  @permissionRequired()
  @providerApiMethod()
  public async web3SignRaw(
    request: IJsBridgeMessagePayload,
    params: SignerPayloadRaw,
  ) {
    debugLogger.providerApi.info('Polkadot executeMoveCall', params);

    const { walletId, networkId, accountId } = getActiveWalletAccount();
    const selectAccount = await this.findAccount(
      walletId,
      networkId,
      params.address,
    );

    if (selectAccount.id !== accountId) {
      throw web3Errors.provider.custom({
        code: 4003,
        message: 'Account not match',
      });
    }

    const unsignedMessage: CommonMessage = {
      type: CommonMessageTypes.SIGN_MESSAGE,
      message: params.data,
      secure: true,
    };

    const result = (await this.backgroundApi.serviceDapp.openSignAndSendModal(
      request,
      {
        unsignedMessage,
        signOnly: true,
      },
    )) as string;

    return Promise.resolve({
      id: request.id ?? 0,
      signature: result ?? '',
    });
  }

  @providerApiMethod()
  public async web3RpcSubscribe(
    request: IJsBridgeMessagePayload,
    params: RequestRpcSubscribe,
  ) {
    debugLogger.providerApi.info('Polkadot web3RpcSubscribe', params);

    const { networkId, accountId } = getActiveWalletAccount();

    const vault = (await this.backgroundApi.engine.getVault({
      networkId,
      accountId,
    })) as VaultDot;

    const { rpcURL } = await this.backgroundApi.engine.getNetwork(networkId);
    const provider = vault.getNodeProviderCache(rpcURL);

    return provider.subscribe(
      params.type,
      params.method,
      params.params,
      (error, result) => {
        const response = {
          method: 'wallet_events_accountChanged',
          result: JSON.stringify({
            error,
            result,
          }),
        };

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        this.backgroundApi.sendForProvider(this.providerName).send(response);
      },
    );
  }

  @providerApiMethod()
  public async web3RpcUnSubscribe(
    request: IJsBridgeMessagePayload,
    params: RequestRpcUnsubscribe,
  ) {
    debugLogger.providerApi.info('Polkadot web3RpcUnSubscribe', params);

    const { networkId, accountId } = getActiveWalletAccount();

    const vault = (await this.backgroundApi.engine.getVault({
      networkId,
      accountId,
    })) as VaultDot;

    const { rpcURL } = await this.backgroundApi.engine.getNetwork(networkId);
    const provider = vault.getNodeProviderCache(rpcURL);

    return provider.unsubscribe(params.type, params.method, params.id);
  }

  @providerApiMethod()
  public async web3RpcSend(
    request: IJsBridgeMessagePayload,
    params: RequestRpcSend,
  ) {
    debugLogger.providerApi.info('Polkadot web3RpcSend', params);

    const { networkId, accountId } = getActiveWalletAccount();

    const vault = (await this.backgroundApi.engine.getVault({
      networkId,
      accountId,
    })) as VaultDot;

    const { rpcURL } = await this.backgroundApi.engine.getNetwork(networkId);
    const provider = vault.getNodeProviderCache(rpcURL);

    return provider.send(params.method, params.params);
  }

  @providerApiMethod()
  public async web3RpcListProviders(
    request: IJsBridgeMessagePayload,
    params: RequestRpcSend,
  ) {
    debugLogger.providerApi.info('Polkadot web3RpcListProviders', params);

    const { networkId, accountId } = getActiveWalletAccount();

    const vault = (await this.backgroundApi.engine.getVault({
      networkId,
      accountId,
    })) as VaultDot;

    const { rpcURL } = await this.backgroundApi.engine.getNetwork(networkId);
    const provider = vault.getNodeProviderCache(rpcURL);

    return Promise.resolve({
      // @ts-expect-error
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      rpcURL: provider.start().meta,
    });
  }

  @providerApiMethod()
  public async web3RpcStartProvider(
    request: IJsBridgeMessagePayload,
    params: RequestRpcSend,
  ) {
    debugLogger.providerApi.info('Polkadot web3RpcStartProvider', params);

    const { networkId, accountId } = getActiveWalletAccount();

    const vault = (await this.backgroundApi.engine.getVault({
      networkId,
      accountId,
    })) as VaultDot;

    const { rpcURL } = await this.backgroundApi.engine.getNetwork(networkId);
    const provider = vault.getNodeProviderCache(rpcURL);

    // @ts-expect-error
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    return Promise.resolve(provider.start().meta);
  }
}

export default ProviderApiPolkadot;
