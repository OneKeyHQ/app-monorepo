import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import {
  IInjectedProviderNames,
  IJsBridgeMessagePayload,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';

import { IMPL_ADA } from '@onekeyhq/engine/src/constants';
import { NetworkId } from '@onekeyhq/engine/src/vaults/impl/ada/types';
import AdaVault from '@onekeyhq/engine/src/vaults/impl/ada/Vault';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { getActiveWalletAccount } from '../../hooks/redux';
import { backgroundClass, providerApiMethod } from '../decorators';

import ProviderApiBase, {
  IProviderBaseBackgroundNotifyInfo,
} from './ProviderApiBase';

@backgroundClass()
class ProviderApiCardano extends ProviderApiBase {
  public providerName = IInjectedProviderNames.cardano;

  public notifyDappAccountsChanged(info: IProviderBaseBackgroundNotifyInfo) {
    const data = () => {
      const result = {
        method: 'wallet_events_accountChanged',
        params: {
          accounts: null,
        },
      };
      return result;
    };

    info.send(data);
  }

  public notifyDappChainChanged(info: IProviderBaseBackgroundNotifyInfo) {
    // TODO
    debugLogger.providerApi.info(info);
  }

  public async rpcCall(request: IJsonRpcRequest): Promise<any> {
    const { networkId, networkImpl } = getActiveWalletAccount();

    if (networkImpl !== IMPL_ADA) {
      return;
    }

    debugLogger.providerApi.info('cardano rpcCall:', request, { networkId });
    const result = await this.backgroundApi.engine.proxyJsonRPCCall(
      networkId,
      request,
    );
    debugLogger.providerApi.info('cardano rpcCall RESULT:', request, {
      networkId,
      result,
    });
    return result;
  }

  private async getAdaVault() {
    const { accountId, networkId } = getActiveWalletAccount();
    const vault = (await this.backgroundApi.engine.getVault({
      networkId,
      accountId,
    })) as AdaVault;
    return vault;
  }

  private getConnectedAccount(request: IJsBridgeMessagePayload) {
    const [account] =
      this.backgroundApi.serviceDapp?.getActiveConnectedAccounts({
        origin: request.origin as string,
        impl: IMPL_ADA,
      });

    console.log(account);
    return Promise.resolve({ address: account.address });
  }

  // ----------------------------------------------
  @providerApiMethod()
  public async connect(request: IJsBridgeMessagePayload) {
    await this.backgroundApi.serviceDapp.openConnectionModal(request);
    const { address } = await this.getConnectedAccount(request);
    return { account: address };
  }

  @providerApiMethod()
  public disconnect(request: IJsBridgeMessagePayload) {
    const { origin } = request;
    if (!origin) {
      return;
    }
    this.backgroundApi.serviceDapp.removeConnectedAccounts({
      origin,
      networkImpl: IMPL_ADA,
      addresses: this.backgroundApi.serviceDapp
        .getActiveConnectedAccounts({ origin, impl: IMPL_ADA })
        .map(({ address }) => address),
    });
    debugLogger.providerApi.info('cardano disconnect', origin);
  }

  @providerApiMethod()
  public async getNetworkId() {
    return Promise.resolve(NetworkId.MAINNET);
  }

  @providerApiMethod()
  public async getUtxos(
    _: IJsBridgeMessagePayload,
    params: { amount?: string },
  ) {
    const vault = await this.getAdaVault();
    return vault.getUtxosForDapp(params.amount);
  }

  @providerApiMethod()
  public async getBalance(request: IJsBridgeMessagePayload) {
    const { address } = await this.getConnectedAccount(request);
    const vault = await this.getAdaVault();
    return vault.getBalanceForDapp(address);
  }

  @providerApiMethod()
  async getUsedAddresses() {
    const vault = await this.getAdaVault();
    return vault.getAccountAddressForDapp();
  }

  @providerApiMethod()
  async getUnusedAddresses() {
    const vault = await this.getAdaVault();
    return vault.getAccountAddressForDapp();
  }

  @providerApiMethod()
  async getChangeAddress() {
    const vault = await this.getAdaVault();
    const [address] = await vault.getAccountAddressForDapp();
    return address;
  }

  @providerApiMethod()
  async getRewardAddresses() {
    const vault = await this.getAdaVault();
    return vault.getStakeAddressForDapp();
  }

  @providerApiMethod()
  async signTx(request: IJsBridgeMessagePayload, params: { tx: string }) {
    const vault = await this.getAdaVault();
    const encodedTx = await vault.buildTxCborToEncodeTx(params.tx);

    const txWitnessSetHex =
      (await this.backgroundApi.serviceDapp?.openSignAndSendModal(request, {
        encodedTx,
        signOnly: true,
      })) as string;

    console.log(txWitnessSetHex);
    return txWitnessSetHex;
  }
}

export default ProviderApiCardano;
