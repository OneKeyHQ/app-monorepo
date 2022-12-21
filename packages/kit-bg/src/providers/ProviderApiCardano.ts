import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';

import { ETHMessageTypes } from '@onekeyhq/engine/src/types/message';
import { NetworkId } from '@onekeyhq/engine/src/vaults/impl/ada/types';
import type AdaVault from '@onekeyhq/engine/src/vaults/impl/ada/Vault';
import { getActiveWalletAccount } from '@onekeyhq/kit/src/hooks/redux';
import {
  backgroundClass,
  providerApiMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { IMPL_ADA } from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import ProviderApiBase from './ProviderApiBase';

import type { IProviderBaseBackgroundNotifyInfo } from './ProviderApiBase';
import type {
  IJsBridgeMessagePayload,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';

@backgroundClass()
class ProviderApiCardano extends ProviderApiBase {
  public providerName = IInjectedProviderNames.cardano;

  public notifyDappAccountsChanged(info: IProviderBaseBackgroundNotifyInfo) {
    const data = async ({ origin }: { origin: string }) => {
      const result = {
        method: 'wallet_events_accountChanged',
        params: {
          accounts: await this.getConnectedAccount({ origin }),
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
    const [account] = this.backgroundApi.serviceDapp.getActiveConnectedAccounts(
      {
        origin: request.origin as string,
        impl: IMPL_ADA,
      },
    );

    return Promise.resolve({ address: account?.address ?? null });
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

    debugLogger.providerApi.debug('cardano signTx witness: ', txWitnessSetHex);
    return txWitnessSetHex;
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

    const signature =
      await this.backgroundApi.serviceDapp?.openSignAndSendModal(request, {
        unsignedMessage: {
          // Use ETH_SIGN to sign plain message
          type: ETHMessageTypes.ETH_SIGN,
          message: Buffer.from(params.payload, 'hex').toString('utf8'),
          payload: params,
        },
      });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return JSON.parse(signature as string);
  }

  @providerApiMethod()
  async submitTx(_: IJsBridgeMessagePayload, params: string) {
    const vault = await this.getAdaVault();
    const client = await vault.getClient();
    const txid = await client.submitTx(params);
    return txid;
  }
}

export default ProviderApiCardano;
