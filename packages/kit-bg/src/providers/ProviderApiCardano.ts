import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';

import { EAdaNetworkId } from '@onekeyhq/core/src/chains/ada/types';
import type IAdaVault from '@onekeyhq/kit-bg/src/vaults/impls/ada/Vault';
import {
  backgroundClass,
  providerApiMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';

import { vaultFactory } from '../vaults/factory';

import ProviderApiBase from './ProviderApiBase';

import type { IProviderBaseBackgroundNotifyInfo } from './ProviderApiBase';
import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

@backgroundClass()
class ProviderApiCardano extends ProviderApiBase {
  public providerName = IInjectedProviderNames.cardano;

  public override notifyDappAccountsChanged(
    info: IProviderBaseBackgroundNotifyInfo,
  ): void {
    const data = async ({ origin }: { origin: string }) => {
      const result = {
        method: 'wallet_events_accountChanged',
        params: {
          accounts: await this.cardano_accounts({
            origin,
            scope: this.providerName,
          }),
        },
      };
      return result;
    };
    info.send(data, info.targetOrigin);
  }

  public override notifyDappChainChanged(): void {
    throw new Error('Method not implemented.');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async rpcCall(request: IJsBridgeMessagePayload): Promise<any> {
    return Promise.resolve();
  }

  @providerApiMethod()
  async cardano_accounts(
    request: IJsBridgeMessagePayload,
  ): Promise<{ account: string } | null> {
    const accountsInfo =
      await this.backgroundApi.serviceDApp.dAppGetConnectedAccountsInfo(
        request,
      );
    if (!accountsInfo) {
      return null;
    }
    return { account: accountsInfo?.[0]?.account.address };
  }

  private async getAdaVault(request: IJsBridgeMessagePayload) {
    const accountsInfo =
      await this.backgroundApi.serviceDApp.dAppGetConnectedAccountsInfo(
        request,
      );
    if (!accountsInfo) {
      return null;
    }
    const { networkId, accountId } = accountsInfo[0].accountInfo ?? {};
    const vault = (await vaultFactory.getVault({
      networkId: networkId ?? '',
      accountId: accountId ?? '',
    })) as IAdaVault;
    return vault;
  }

  // Provider API
  @providerApiMethod()
  async connect(request: IJsBridgeMessagePayload) {
    const connectedAddress = await this.cardano_accounts(request);
    if (connectedAddress) {
      return connectedAddress;
    }
    await this.backgroundApi.serviceDApp.openConnectionModal(request);
    return this.cardano_accounts(request);
  }

  @providerApiMethod()
  async disconnect(request: IJsBridgeMessagePayload) {
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

  @providerApiMethod()
  public async getNetworkId() {
    return Promise.resolve(EAdaNetworkId.MAINNET);
  }

  @providerApiMethod()
  public async getUtxos(
    request: IJsBridgeMessagePayload,
    params: { amount?: string },
  ) {
    const vault = await this.getAdaVault(request);
    if (!vault) {
      throw new Error('Not connected to any account.');
    }
    return vault.getUtxosForDapp(params.amount);
  }

  @providerApiMethod()
  public async getBalance(request: IJsBridgeMessagePayload) {
    const vault = await this.getAdaVault(request);
    if (!vault) {
      throw new Error('Not connected to any account.');
    }
    return vault.getBalanceForDapp();
  }

  @providerApiMethod()
  async getUsedAddresses(request: IJsBridgeMessagePayload) {
    const vault = await this.getAdaVault(request);
    if (!vault) {
      throw new Error('Not connected to any account.');
    }
    return vault.getAccountAddressForDapp();
  }

  @providerApiMethod()
  async getUnusedAddresses(request: IJsBridgeMessagePayload) {
    const vault = await this.getAdaVault(request);
    if (!vault) {
      throw new Error('Not connected to any account.');
    }
    return vault.getAccountAddressForDapp();
  }

  @providerApiMethod()
  async getChangeAddress(request: IJsBridgeMessagePayload) {
    const vault = await this.getAdaVault(request);
    if (!vault) {
      throw new Error('Not connected to any account.');
    }
    const [address] = await vault.getAccountAddressForDapp();
    return address;
  }

  @providerApiMethod()
  async getRewardAddresses(request: IJsBridgeMessagePayload) {
    const vault = await this.getAdaVault(request);
    if (!vault) {
      throw new Error('Not connected to any account.');
    }
    return vault.getStakeAddressForDapp();
  }

  @providerApiMethod()
  async signTx(request: IJsBridgeMessagePayload, params: { tx: string }) {
    const vault = await this.getAdaVault(request);
    if (!vault) {
      throw new Error('Not connected to any account.');
    }
    const { accountInfo: { networkId, accountId } = {} } = (
      await this.getAccountsInfo(request)
    )[0];
    const encodedTx = await vault.buildTxCborToEncodeTx(params.tx);
    const result =
      await this.backgroundApi.serviceDApp.openSignAndSendTransactionModal({
        request,
        encodedTx,
        accountId: accountId ?? '',
        networkId: networkId ?? '',
      });
    return result;
  }

  @providerApiMethod()
  async signData(
    request: IJsBridgeMessagePayload,
    params: {
      addr: string;
      payload: string;
    },
  ) {
    if (typeof params.payload !== 'string') {
      throw web3Errors.rpc.invalidInput();
    }
    const { accountInfo: { accountId, networkId } = {} } = (
      await this.getAccountsInfo(request)
    )[0];

    const signature = await this.backgroundApi.serviceDApp.openSignMessageModal(
      {
        request,
        unsignedMessage: {
          // Use ETH_SIGN to sign plain message
          type: EMessageTypesEth.ETH_SIGN,
          message: Buffer.from(params.payload, 'hex').toString('utf8'),
          payload: params,
        },
        networkId: networkId ?? '',
        accountId: accountId ?? '',
      },
    );

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return JSON.parse(signature as any);
  }

  @providerApiMethod()
  async submitTx(request: IJsBridgeMessagePayload, params: string) {
    const { accountInfo: { networkId, address } = {} } = (
      await this.getAccountsInfo(request)
    )[0];
    return this.backgroundApi.serviceSend.broadcastTransaction({
      networkId: networkId ?? '',
      signedTx: {
        txid: '',
        rawTx: params,
        encodedTx: null,
      },
      accountAddress: address ?? '',
    });
  }
}

export default ProviderApiCardano;
