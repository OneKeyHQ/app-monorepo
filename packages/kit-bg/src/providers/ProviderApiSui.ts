import { TransactionBlock } from '@mysten/sui.js';
import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';

import type { IEncodedTxSui } from '@onekeyhq/core/src/chains/sui/types';
import type { ISignedTxPro } from '@onekeyhq/core/src/types';
import type IVaultSui from '@onekeyhq/kit-bg/src/vaults/impls/sui/Vault';
import {
  backgroundClass,
  providerApiMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import { EMessageTypesCommon } from '@onekeyhq/shared/types/message';
import type {
  ISignAndExecuteTransactionBlockInput,
  ISignMessageInput,
  ISignTransactionBlockInput,
  ISignTransactionBlockOutput,
} from '@onekeyhq/shared/types/ProviderApis/ProviderApiSui.type';

import { vaultFactory } from '../vaults/factory';

import ProviderApiBase from './ProviderApiBase';

import type { IProviderBaseBackgroundNotifyInfo } from './ProviderApiBase';
import type {
  SignedMessage,
  SignedPersonalMessage,
  SuiTransactionBlockResponse,
} from '@mysten/sui.js';
import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

@backgroundClass()
class ProviderApiSui extends ProviderApiBase {
  public providerName = IInjectedProviderNames.ethereum;

  public override notifyDappAccountsChanged(
    info: IProviderBaseBackgroundNotifyInfo,
  ): void {
    const data = async ({ origin }: { origin: string }) => {
      const result = {
        method: 'wallet_events_accountChanged',
        params: await this.sui_accounts({ origin }),
      };
      return result;
    };
    info.send(data, info.targetOrigin);
  }

  public override notifyDappChainChanged(
    info: IProviderBaseBackgroundNotifyInfo,
  ): void {
    const data = () => {
      const result = {
        method: 'wallet_events_networkChange',
        params: 'sui:mainnet',
      };
      return result;
    };
    info.send(data, info.targetOrigin);
  }

  public async rpcCall(): Promise<any> {
    throw web3Errors.rpc.methodNotSupported();
  }

  @providerApiMethod()
  async sui_accounts(
    request: IJsBridgeMessagePayload,
  ): Promise<{ address: string; publicKey: string } | null> {
    const accountsInfo =
      await this.backgroundApi.serviceDApp.dAppGetConnectedAccountsInfo(
        request,
      );
    if (!accountsInfo) {
      return null;
    }
    const account = accountsInfo?.[0]?.account;
    return {
      address: account.address,
      publicKey: account.pub ?? '',
    };
  }

  // Provider API
  @providerApiMethod()
  public async hasPermissions(
    request: IJsBridgeMessagePayload,
  ): Promise<boolean> {
    return !!(await this.sui_accounts(request));
  }

  @providerApiMethod()
  async requestPermissions(request: IJsBridgeMessagePayload): Promise<boolean> {
    const account = await this.sui_accounts(request);
    if (account) {
      return true;
    }
    await this.backgroundApi.serviceDApp.openConnectionModal(request);
    return !!(await this.sui_accounts(request));
  }

  @providerApiMethod()
  public async getAccounts(
    request: IJsBridgeMessagePayload,
  ): Promise<{ address: string; publicKey: string }[]> {
    let account = await this.sui_accounts(request);

    if (account) {
      return [account];
    }

    await this.backgroundApi.serviceDApp.openConnectionModal(request);

    account = await this.sui_accounts(request);

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
    void this.backgroundApi.serviceDApp.disconnectWebsite({
      origin,
      storageType: request.isWalletConnectRequest
        ? 'walletConnect'
        : 'injectedProvider',
    });
  }

  @providerApiMethod()
  public getActiveChain() {
    return Promise.resolve('sui:mainnet');
  }

  @providerApiMethod()
  public async signAndExecuteTransactionBlock(
    request: IJsBridgeMessagePayload,
    params: ISignAndExecuteTransactionBlockInput,
  ): Promise<SuiTransactionBlockResponse> {
    const { accountInfo: { accountId, networkId, address } = {} } = (
      await this.getAccountsInfo(request)
    )[0];
    const encodedTx: IEncodedTxSui = {
      rawTx: TransactionBlock.from(params.blockSerialize).serialize(),
      sender: address ?? '',
    };
    const result =
      (await this.backgroundApi.serviceDApp.openSignAndSendTransactionModal({
        request,
        encodedTx,
        accountId: accountId ?? '',
        networkId: networkId ?? '',
      })) as string;

    const vault = (await vaultFactory.getVault({
      accountId: accountId ?? '',
      networkId: networkId ?? '',
    })) as IVaultSui;
    const tx = await vault.waitPendingTransaction(result, params.options);

    if (!tx) throw new Error('Transaction not found');

    return Promise.resolve(tx);
  }

  @providerApiMethod()
  public async signTransactionBlock(
    request: IJsBridgeMessagePayload,
    params: ISignTransactionBlockInput,
  ): Promise<ISignTransactionBlockOutput> {
    const { accountInfo: { accountId, networkId, address } = {} } = (
      await this.getAccountsInfo(request)
    )[0];
    const encodedTx: IEncodedTxSui = {
      rawTx: TransactionBlock.from(params.blockSerialize).serialize(),
      sender: address ?? '',
    };

    const result =
      (await this.backgroundApi.serviceDApp.openSignAndSendTransactionModal({
        request,
        encodedTx,
        accountId: accountId ?? '',
        networkId: networkId ?? '',
        signOnly: true,
      })) as ISignedTxPro;

    if (!result.signature) throw web3Errors.provider.unauthorized();

    return Promise.resolve({
      transactionBlockBytes: result.rawTx,
      signature: result.signature,
    });
  }

  @providerApiMethod()
  public async signMessage(
    request: IJsBridgeMessagePayload,
    params: ISignMessageInput,
  ): Promise<SignedPersonalMessage> {
    const { accountInfo: { accountId, networkId, address } = {} } = (
      await this.getAccountsInfo(request)
    )[0];

    const result = (await this.backgroundApi.serviceDApp.openSignMessageModal({
      request,
      accountId: accountId ?? '',
      networkId: networkId ?? '',
      unsignedMessage: {
        type: EMessageTypesCommon.SIMPLE_SIGN,
        message: params.messageSerialize,
        secure: true,
      },
    })) as string;

    return {
      bytes: bufferUtils.hexToText(params.messageSerialize, 'base64'),
      signature: result,
    };
  }

  @providerApiMethod()
  public async signPersonalMessage(
    request: IJsBridgeMessagePayload,
    params: ISignMessageInput,
  ): Promise<SignedPersonalMessage> {
    return this.signMessage(request, params);
  }
}

export default ProviderApiSui;
