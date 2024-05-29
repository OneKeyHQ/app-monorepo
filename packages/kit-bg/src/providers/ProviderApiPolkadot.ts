/* eslint-disable @typescript-eslint/no-unused-vars */
import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';
import { decodeAddress, encodeAddress } from '@polkadot/util-crypto/address';

import type { IEncodedTxDot } from '@onekeyhq/core/src/chains/dot/types';
import type { ISignedTxPro } from '@onekeyhq/core/src/types';
import {
  backgroundClass,
  permissionRequired,
  providerApiMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  NotImplemented,
  OneKeyInternalError,
} from '@onekeyhq/shared/src/errors';
import { EMessageTypesCommon } from '@onekeyhq/shared/types/message';

import ProviderApiBase from './ProviderApiBase';

import type { IProviderBaseBackgroundNotifyInfo } from './ProviderApiBase';
import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';
import type { InjectedAccount } from '@polkadot/extension-inject/types';
import type {
  SignerPayloadJSON,
  SignerPayloadRaw,
} from '@polkadot/types/types';

export interface IRequestRpcSend {
  method: string;
  params: unknown[];
}

export interface IRequestRpcSubscribe extends IRequestRpcSend {
  type: string;
}

export interface IRequestRpcUnsubscribe {
  type: string;
  method: string;
  id: string;
}

export interface ISignerResult {
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
      const params = await this.account({ origin, scope: 'polkadot' });
      const result = {
        method: 'wallet_events_accountChanged',
        params,
      };
      return result;
    };
    info.send(data, info.targetOrigin);
  }

  public notifyDappChainChanged(info: IProviderBaseBackgroundNotifyInfo) {
    const data = async ({ origin }: { origin: string }) => {
      const account = await this.account({ origin });
      const networkId = account?.networkId;
      const result = {
        // TODO do not emit events to EVM Dapps, injected provider check scope
        method: 'wallet_events_networkChange',
        params: networkId,
      };
      return result;
    };
    info.send(data, info.targetOrigin);
  }

  public rpcCall() {
    throw web3Errors.rpc.methodNotSupported();
  }

  @providerApiMethod()
  public async web3Enable(request: IJsBridgeMessagePayload): Promise<boolean> {
    if (await this.account(request)) {
      return true;
    }

    const res = await this.backgroundApi.serviceDApp.openConnectionModal(
      request,
    );

    return !!res;
  }

  @permissionRequired()
  @providerApiMethod()
  public async web3Accounts(
    request: IJsBridgeMessagePayload,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    params: boolean,
  ): Promise<InjectedAccount[]> {
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
  public async disconnect(request: IJsBridgeMessagePayload) {
    const { origin } = request;
    if (!origin) {
      return;
    }
    await this.backgroundApi.serviceDApp.disconnectWebsite({
      origin,
      storageType: request.isWalletConnectRequest
        ? 'walletConnect'
        : 'injectedProvider',
    });
  }

  private async account(request: IJsBridgeMessagePayload): Promise<
    | {
        address: string;
        name: string;
        networkId?: string;
        id?: string;
      }
    | undefined
  > {
    const accounts =
      await this.backgroundApi.serviceDApp.dAppGetConnectedAccountsInfo(
        request,
      );
    if (!accounts) {
      return undefined;
    }
    const { account, accountInfo } = accounts[0];

    return {
      address: account.address,
      name: account.name,
      networkId: accountInfo?.networkId,
      id: account.id,
    };
  }

  private async findAccount(request: IJsBridgeMessagePayload, address: string) {
    const accounts = await this.getAccountsInfo(request);

    const selectAccount = accounts.find(({ account }) => {
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
  ): Promise<ISignerResult> {
    const { account, accountInfo } = await this.findAccount(
      request,
      params.address,
    );
    const encodeTx: IEncodedTxDot = {
      ...params,
      metadataRpc: '' as `0x${string}`,
    };

    const result =
      (await this.backgroundApi.serviceDApp.openSignAndSendTransactionModal({
        request,
        encodedTx: encodeTx,
        signOnly: true,
        accountId: account.id,
        networkId: accountInfo?.networkId ?? '',
      })) as ISignedTxPro;

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
    const { account, accountInfo } = await this.findAccount(
      request,
      params.address,
    );

    const unsignedMessage = {
      type: EMessageTypesCommon.SIGN_MESSAGE,
      message: params.data,
      secure: true,
    };

    const result = (await this.backgroundApi.serviceDApp.openSignMessageModal({
      request,
      unsignedMessage,
      accountId: account.id,
      networkId: accountInfo?.networkId ?? '',
    })) as string;

    return Promise.resolve({
      id: request.id ?? 0,
      signature: result ?? '',
    });
  }

  @providerApiMethod()
  public async web3RpcSubscribe(
    request: IJsBridgeMessagePayload,
    params: IRequestRpcSubscribe,
  ) {
    throw new NotImplemented();
  }

  @providerApiMethod()
  public async web3RpcUnSubscribe(
    request: IJsBridgeMessagePayload,
    params: IRequestRpcUnsubscribe,
  ) {
    throw new NotImplemented();
  }

  @providerApiMethod()
  public async web3RpcSend(
    request: IJsBridgeMessagePayload,
    params: IRequestRpcSend,
  ) {
    throw new NotImplemented();
  }

  @providerApiMethod()
  public async web3RpcListProviders(
    request: IJsBridgeMessagePayload,
    params: IRequestRpcSend,
  ) {
    throw new NotImplemented();
  }

  @providerApiMethod()
  public async web3RpcStartProvider(
    request: IJsBridgeMessagePayload,
    params: IRequestRpcSend,
  ) {
    throw new NotImplemented();
  }
}

export default ProviderApiPolkadot;
