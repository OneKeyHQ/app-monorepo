import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';
import BigNumber from 'bignumber.js';
import { isNil } from 'lodash';

import {
  backgroundClass,
  providerApiMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type {
  ISendBitcoinParams,
  ISignMessageParams,
  ISwitchNetworkParams,
} from '@onekeyhq/shared/types/ProviderApis/ProviderApiBtc.type';

import { vaultFactory } from '../vaults/factory';

import ProviderApiBase from './ProviderApiBase';

import type { IProviderBaseBackgroundNotifyInfo } from './ProviderApiBase';
import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

@backgroundClass()
class ProviderApiBtc extends ProviderApiBase {
  public providerName = IInjectedProviderNames.btc;

  public override notifyDappAccountsChanged(
    info: IProviderBaseBackgroundNotifyInfo,
  ): void {
    const data = async ({ origin }: { origin: string }) => {
      const result = {
        method: 'wallet_events_accountChanged',
        params: {
          accounts: await this.getAccounts({
            origin,
            scope: this.providerName,
          }),
        },
      };
      return result;
    };
    info.send(data, info.targetOrigin);
  }

  public override notifyDappChainChanged(
    info: IProviderBaseBackgroundNotifyInfo,
  ): void {
    const data = async ({ origin }: { origin: string }) => {
      const params = await this.getNetwork({
        origin,
        scope: this.providerName,
      });
      const result = {
        method: 'wallet_events_networkChanged',
        params,
      };
      return result;
    };
    info.send(data, info.targetOrigin);
  }

  public async rpcCall(): Promise<any> {
    throw web3Errors.rpc.methodNotSupported();
  }

  @providerApiMethod()
  public async getProviderState() {
    return {
      network: '',
      isUnlocked: true,
      accounts: [],
    };
  }

  // Provider API
  @providerApiMethod()
  public async requestAccounts(request: IJsBridgeMessagePayload) {
    const accounts = await this.getAccounts(request);
    if (accounts && accounts.length) {
      return accounts;
    }
    await this.backgroundApi.serviceDApp.openConnectionModal(request);
    return this.getAccounts(request);
  }

  @providerApiMethod()
  async getAccounts(request: IJsBridgeMessagePayload) {
    const accountsInfo =
      await this.backgroundApi.serviceDApp.dAppGetConnectedAccountsInfo(
        request,
      );
    if (!accountsInfo) {
      return Promise.resolve([]);
    }
    return Promise.resolve(accountsInfo.map((i) => i.account.address));
  }

  @providerApiMethod()
  public async getPublicKey(request: IJsBridgeMessagePayload) {
    const accountsInfo =
      await this.backgroundApi.serviceDApp.dAppGetConnectedAccountsInfo(
        request,
      );
    if (!accountsInfo) {
      return Promise.resolve('');
    }
    return Promise.resolve(accountsInfo[0]?.account?.pub);
  }

  @providerApiMethod()
  public async getNetwork(request: IJsBridgeMessagePayload) {
    const networks = await this.backgroundApi.serviceDApp.getConnectedNetworks({
      origin: request.origin ?? '',
      scope: request.scope ?? this.providerName,
    });
    if (Array.isArray(networks) && networks.length) {
      return networkUtils.getBtcDappNetworkName(networks[0]);
    }
    return '';
  }

  @providerApiMethod()
  public async switchNetwork(
    request: IJsBridgeMessagePayload,
    params: ISwitchNetworkParams,
  ) {
    console.log('ProviderApiBtc.switchNetwork');

    const { network: networkName } = params;
    let networkId;
    if (networkName === 'livenet') {
      networkId = getNetworkIdsMap().btc;
    } else if (networkName === 'testnet') {
      networkId = getNetworkIdsMap().tbtc;
    }
    if (!networkId) {
      throw web3Errors.provider.custom({
        code: 4000,
        message: `Unrecognized network ${networkName}.`,
      });
    }
    await this.backgroundApi.serviceDApp.switchConnectedNetwork({
      origin: request.origin ?? '',
      scope: request.scope ?? this.providerName,
      newNetworkId: networkId,
    });
    // TODO: use real data
    return 'testnet';
  }

  @providerApiMethod()
  public async getBalance(request: IJsBridgeMessagePayload) {
    const { accountInfo: { networkId, accountId } = {} } = (
      await this.getAccountsInfo(request)
    )[0];
    const accountAddress =
      await this.backgroundApi.serviceAccount.getAccountAddressForApi({
        networkId: networkId ?? '',
        accountId: accountId ?? '',
      });
    const { balance } =
      await this.backgroundApi.serviceAccountProfile.fetchAccountDetails({
        networkId: networkId ?? '',
        xpub: await this.backgroundApi.serviceAccount.getAccountXpub({
          accountId: accountId ?? '',
          networkId: networkId ?? '',
        }),
        accountAddress,
      });
    return {
      confirmed: balance,
      unconfirmed: 0,
      total: balance,
    };
  }

  @providerApiMethod()
  public async getInscriptions() {
    throw web3Errors.rpc.methodNotSupported();
  }

  @providerApiMethod()
  public async sendBitcoin(
    request: IJsBridgeMessagePayload,
    params: ISendBitcoinParams,
  ) {
    const { toAddress, satoshis, feeRate } = params;
    const accountsInfo = await this.getAccountsInfo(request);
    const { accountInfo: { accountId, networkId, address } = {} } =
      accountsInfo[0];

    if (!networkId || !accountId) {
      throw web3Errors.provider.custom({
        code: 4002,
        message: `Can not get account`,
      });
    }

    const amountBN = new BigNumber(satoshis);

    if (amountBN.isNaN() || amountBN.isNegative()) {
      throw web3Errors.rpc.invalidParams('Invalid satoshis');
    }

    const vault = await vaultFactory.getVault({
      networkId,
      accountId,
    });
    const network = await this.backgroundApi.serviceNetwork.getNetwork({
      networkId,
    });

    const transfersInfo = [
      {
        from: address ?? '',
        to: toAddress,
        amount: amountBN.shiftedBy(-network.decimals).toFixed(),
      },
    ];
    const encodedTx = await vault.buildEncodedTx({
      transfersInfo,
      specifiedFeeRate: isNil(feeRate)
        ? undefined
        : new BigNumber(feeRate).shiftedBy(-network.feeMeta.decimals).toFixed(),
    });

    const result =
      await this.backgroundApi.serviceDApp.openSignAndSendTransactionModal({
        request,
        encodedTx,
        accountId: accountId ?? '',
        networkId: networkId ?? '',
        transfersInfo,
      });
    return result;
  }

  @providerApiMethod()
  public async signMessage(
    request: IJsBridgeMessagePayload,
    params: ISignMessageParams,
  ) {
    const { message, type } = params;
    const accountsInfo = await this.getAccountsInfo(request);
    const { accountInfo: { accountId, networkId } = {} } = accountsInfo[0];

    if (type !== 'bip322-simple' && type !== 'ecdsa') {
      throw web3Errors.rpc.invalidParams('Invalid type');
    }

    const result = await this.backgroundApi.serviceDApp.openSignMessageModal({
      request,
      accountId: accountId ?? '',
      networkId: networkId ?? '',
      unsignedMessage: {
        type,
        message,
        sigOptions: {
          noScriptType: true,
        },
        payload: {
          isFromDApp: true,
        },
      },
    });
    return Buffer.from(result as string, 'hex').toString('base64');
  }
}

export default ProviderApiBtc;
