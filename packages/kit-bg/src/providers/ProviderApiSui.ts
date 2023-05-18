import { TransactionBlock } from '@mysten/sui.js';
/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable camelcase */
import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';
import { get } from 'lodash';

import { parseNetworkId } from '@onekeyhq/engine/src/managers/network';
import type { DBSimpleAccount } from '@onekeyhq/engine/src/types/account';
import { CommonMessageTypes } from '@onekeyhq/engine/src/types/message';
import type { IEncodedTxSUI } from '@onekeyhq/engine/src/vaults/impl/sui/types';
import type VaultSUI from '@onekeyhq/engine/src/vaults/impl/sui/Vault';
import type { ISignedTxPro } from '@onekeyhq/engine/src/vaults/types';
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
  ExecuteTransactionRequestType,
  SignedMessage,
  SignedTransaction,
  SuiTransactionBlockResponse,
  SuiTransactionBlockResponseOptions,
} from '@mysten/sui.js';
import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';
import type {
  PermissionType,
  SuiChainType,
} from '@onekeyfe/onekey-sui-provider';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface AccountInfo {
  address: string;
  publicKey: string;
}

type IdentifierString = `${string}:${string}`;
type IdentifierArray = readonly IdentifierString[];
type WalletIcon = `data:image/${
  | 'svg+xml'
  | 'webp'
  | 'png'
  | 'gif'};base64,${string}`;

interface WalletAccount {
  readonly address: string;
  readonly publicKey: Uint8Array;
  readonly chains: IdentifierArray;
  readonly features: IdentifierArray;
  readonly label?: string;
  readonly icon?: WalletIcon;
}

type SignAndExecuteTransactionBlockInput = {
  blockSerialize: string;
  walletSerialize: string;
  account: WalletAccount;
  chain: IdentifierString;
  requestType?: ExecuteTransactionRequestType;
  options?: SuiTransactionBlockResponseOptions;
};
type SignAndExecuteTransactionBlockOutput = SuiTransactionBlockResponse;

type SignTransactionBlockInput = {
  blockSerialize: string;
  walletSerialize: string;
  account: WalletAccount;
  chain: IdentifierString;
};
type SignTransactionBlockOutput = SignedTransaction;

type SignMessageInput = {
  messageSerialize: string;
  walletSerialize: string;
  account: WalletAccount;
};
type SignMessageOutput = SignedMessage;

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
  ): Promise<AccountInfo[]> {
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
  ): Promise<AccountInfo | undefined> {
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
    const account = (await vault.getDbAccount()) as DBSimpleAccount;

    const addresses = connectedAccounts.map((a) => a.address);
    if (!addresses.includes(address)) {
      return undefined;
    }

    return Promise.resolve({
      address,
      publicKey: account.pub,
    });
  }

  @permissionRequired()
  @providerApiMethod()
  public getActiveChain(
    request: IJsBridgeMessagePayload,
  ): Promise<IdentifierString | undefined> {
    debugLogger.providerApi.info('SUI getActiveChain', request);

    try {
      return Promise.resolve(this.network());
    } catch (e) {
      return Promise.resolve(undefined);
    }
  }

  private network(): SuiChainType {
    const { networkId } = getActiveWalletAccount();

    const { impl, chainId } = parseNetworkId(networkId);

    if (impl !== IMPL_SUI) {
      throw web3Errors.rpc.invalidRequest();
    }
    if (chainId === 'mainnet') {
      return 'sui:mainnet';
    }
    if (chainId === '8888883') {
      return 'sui:testnet';
    }
    if (chainId === '8888884') {
      return 'sui:devnet';
    }

    throw web3Errors.rpc.invalidRequest();
  }

  @permissionRequired()
  @providerApiMethod()
  public async signAndExecuteTransactionBlock(
    request: IJsBridgeMessagePayload,
    params: SignAndExecuteTransactionBlockInput,
  ): Promise<SignAndExecuteTransactionBlockOutput> {
    debugLogger.providerApi.info('SUI signAndExecuteTransactionBlock', params);
    const { networkId, accountId, accountAddress } = getActiveWalletAccount();

    const address = get(JSON.parse(params.walletSerialize), 'address');
    if (address && address !== accountAddress) {
      throw web3Errors.provider.unauthorized();
    }

    const vault = (await this.backgroundApi.engine.getVault({
      networkId,
      accountId,
    })) as VaultSUI;

    const encodeTx: IEncodedTxSUI = {
      rawTx: TransactionBlock.from(params.blockSerialize).serialize(),
    };

    const result = (await this.backgroundApi.serviceDapp.openSignAndSendModal(
      request,
      { encodedTx: encodeTx },
    )) as string;

    const tx = await vault.waitPendingTransaction(result, params.options);

    if (!tx) throw new Error('Transaction not found');

    return Promise.resolve(tx);
  }

  @permissionRequired()
  @providerApiMethod()
  public async signTransactionBlock(
    request: IJsBridgeMessagePayload,
    params: SignTransactionBlockInput,
  ): Promise<SignTransactionBlockOutput> {
    debugLogger.providerApi.info('SUI signTransactionBlock', params);

    const { accountAddress } = getActiveWalletAccount();

    const address = get(JSON.parse(params.walletSerialize), 'address');
    if (address && address !== accountAddress) {
      throw web3Errors.provider.unauthorized();
    }

    const encodeTx: IEncodedTxSUI = {
      rawTx: TransactionBlock.from(params.blockSerialize).serialize(),
    };

    const result = (await this.backgroundApi.serviceDapp.openSignAndSendModal(
      request,
      {
        encodedTx: encodeTx,
        signOnly: true,
      },
    )) as ISignedTxPro;

    if (!result.signature) throw web3Errors.provider.unauthorized();

    return Promise.resolve({
      transactionBlockBytes: result.rawTx,
      signature: result.signature,
    });
  }

  @permissionRequired()
  @providerApiMethod()
  public async signMessage(
    request: IJsBridgeMessagePayload,
    params: SignMessageInput,
  ): Promise<SignMessageOutput> {
    debugLogger.providerApi.info('SUI signMessage', params);

    const { accountAddress } = getActiveWalletAccount();

    const address = get(JSON.parse(params.walletSerialize), 'address');
    if (address && address !== accountAddress) {
      throw web3Errors.provider.unauthorized();
    }

    const result = (await this.backgroundApi.serviceDapp.openSignAndSendModal(
      request,
      {
        unsignedMessage: {
          type: CommonMessageTypes.SIGN_MESSAGE,
          message: params.messageSerialize,
          secure: false,
        },
      },
    )) as string;

    return {
      messageBytes: params.messageSerialize,
      signature: result,
    };
  }
}

export default ProviderApiSui;
