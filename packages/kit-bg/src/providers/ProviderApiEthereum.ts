import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';
import BigNumber from 'bignumber.js';
import * as ethUtils from 'ethereumjs-util';
import { isNil } from 'lodash';

import type { IEncodedTxEvm } from '@onekeyhq/core/src/chains/evm/types';
import {
  backgroundClass,
  permissionRequired,
  providerApiMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';

import ProviderApiBase from './ProviderApiBase';

import type { IProviderBaseBackgroundNotifyInfo } from './ProviderApiBase';
import type {
  IJsBridgeMessagePayload,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';

export type ISwitchEthereumChainParameter = {
  chainId: string;
  networkId?: string;
};

function prefixTxValueToHex(value: string) {
  if (value?.startsWith?.('0X') && value?.slice) {
    // eslint-disable-next-line no-param-reassign
    value = value.slice(2);
  }
  if (
    value &&
    value.startsWith &&
    !value.startsWith('0x') &&
    !value.startsWith('0X')
  ) {
    return `0x${value}`;
  }
  return value;
}

@backgroundClass()
class ProviderApiEthereum extends ProviderApiBase {
  public providerName = IInjectedProviderNames.ethereum;

  public override notifyDappAccountsChanged(
    info: IProviderBaseBackgroundNotifyInfo,
  ): void {
    const data = async ({ origin }: { origin: string }) => {
      const result = {
        method: 'metamask_accountsChanged',
        params: await this.eth_accounts({ origin, scope: this.providerName }),
      };
      return result;
    };
    info.send(data, info.targetOrigin);
  }

  public override notifyDappChainChanged(
    info: IProviderBaseBackgroundNotifyInfo,
  ): void {
    const data = async ({ origin }: { origin: string }) => {
      const result = {
        method: 'metamask_chainChanged',
        params: {
          chainId: await this.eth_chainId({ origin, scope: this.providerName }),
          networkVersion: await this.net_version({
            origin,
            scope: this.providerName,
          }),
        },
      };

      return result;
    };

    info.send(data, info.targetOrigin);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async rpcCall(request: IJsonRpcRequest): Promise<any> {
    console.log(`${this.providerName} RpcCall=====>>>> : BgApi:`, request);
    return Promise.resolve();
  }

  @providerApiMethod()
  async eth_requestAccounts(request: IJsBridgeMessagePayload) {
    const accounts = await this.eth_accounts(request);
    if (accounts && accounts.length) {
      return accounts;
    }
    await this.backgroundApi.serviceDApp.openConnectionModal(request);
    return this.eth_accounts(request);
  }

  @providerApiMethod()
  async eth_coinbase(request: IJsBridgeMessagePayload): Promise<string | null> {
    const accounts = await this.eth_accounts(request);
    return accounts?.[0] || null;
  }

  @providerApiMethod()
  async eth_accounts(request: IJsBridgeMessagePayload): Promise<string[]> {
    const accountsInfo =
      await this.backgroundApi.serviceDApp.dAppGetConnectedAccountsInfo(
        request,
      );
    if (!accountsInfo) {
      return Promise.resolve([]);
    }
    return Promise.resolve(accountsInfo.map((i) => i.account?.address));
  }

  @providerApiMethod()
  async wallet_requestPermissions(
    request: IJsBridgeMessagePayload,
    permissions: Record<string, unknown>,
  ) {
    const permissionRes =
      await this.backgroundApi.serviceDApp.openConnectionModal(request);

    const result = Object.keys(permissions).map((permissionName) => {
      if (permissionName === 'eth_accounts') {
        return {
          caveats: [
            {
              type: 'restrictReturnedAccounts',
              value: permissionRes as string[],
            },
          ],
          date: Date.now(),
          id: request.id?.toString() ?? generateUUID(),
          invoker: request.origin,
          parentCapability: permissionName,
        };
      }

      return {
        caveats: [],
        date: Date.now(),
        id: request.id?.toString() ?? generateUUID(),
        invoker: request.origin,
        parentCapability: permissionName,
      };
    });

    return result;
  }

  @providerApiMethod()
  async wallet_getPermissions(request: IJsBridgeMessagePayload) {
    const result = [
      {
        caveats: [],
        date: Date.now(),
        id: request.id?.toString(),
        invoker: request.origin as string,
        parentCapability: 'eth_accounts',
      },
    ];
    return Promise.resolve(result);
  }

  @providerApiMethod()
  async eth_chainId(request: IJsBridgeMessagePayload) {
    const networks = await this.backgroundApi.serviceDApp.getConnectedNetworks(
      request,
    );
    if (!isNil(networks?.[0]?.chainId)) {
      return hexUtils.hexlify(Number(networks?.[0]?.chainId));
    }
  }

  @providerApiMethod()
  async net_version(request: IJsBridgeMessagePayload) {
    const networks = await this.backgroundApi.serviceDApp.getConnectedNetworks(
      request,
    );
    if (!isNil(networks?.[0]?.chainId)) {
      return networks?.[0]?.chainId;
    }
  }

  @providerApiMethod()
  eth_signTransaction() {
    throw web3Errors.provider.unsupportedMethod();
  }

  @permissionRequired()
  @providerApiMethod()
  async eth_sendTransaction(
    request: IJsBridgeMessagePayload,
    transaction: IEncodedTxEvm,
  ) {
    const accountsInfo =
      await this.backgroundApi.serviceDApp.dAppGetConnectedAccountsInfo(
        request,
      );
    if (!accountsInfo) {
      throw web3Errors.provider.unauthorized();
    }
    if (!isNil(transaction.value)) {
      transaction.value = prefixTxValueToHex(transaction.value);
    }
    const { accountInfo: { accountId, networkId } = {} } = accountsInfo[0];

    const nonceBN = new BigNumber(transaction.nonce ?? 0);

    // https://app.chainspot.io/
    // some dapp may send tx with incorrect nonce 0
    if (nonceBN.isNaN() || nonceBN.isLessThanOrEqualTo(0)) {
      delete transaction.nonce;
    }

    const result =
      await this.backgroundApi.serviceDApp.openSignAndSendTransactionModal({
        request,
        encodedTx: transaction,
        accountId: accountId ?? '',
        networkId: networkId ?? '',
      });

    console.log('eth_sendTransaction DONE', result, request, transaction);

    return result;
  }

  @providerApiMethod()
  eth_subscribe() {
    throw web3Errors.rpc.methodNotSupported();
  }

  @providerApiMethod()
  eth_unsubscribe() {
    throw web3Errors.rpc.methodNotSupported();
  }

  @providerApiMethod()
  async eth_sign(request: IJsBridgeMessagePayload, ...messages: any[]) {
    const accountsInfo =
      await this.backgroundApi.serviceDApp.dAppGetConnectedAccountsInfo(
        request,
      );
    if (!accountsInfo) {
      throw web3Errors.provider.unauthorized();
    }
    const { accountInfo: { accountId, networkId } = {} } = accountsInfo[0];
    return this.backgroundApi.serviceDApp.openSignMessageModal({
      request,
      unsignedMessage: {
        type: EMessageTypesEth.ETH_SIGN,
        message: messages[1],
        payload: messages,
      },
      accountId: accountId ?? '',
      networkId: networkId ?? '',
    });
  }

  // Provider API
  @providerApiMethod()
  async personal_sign(request: IJsBridgeMessagePayload, ...messages: any[]) {
    const accountsInfo =
      await this.backgroundApi.serviceDApp.dAppGetConnectedAccountsInfo(
        request,
      );
    if (!accountsInfo) {
      throw web3Errors.provider.unauthorized();
    }
    const { accountInfo: { accountId, networkId } = {} } = accountsInfo[0];

    let message = messages[0] as string;
    const address = messages[1] as string;

    message = this.autoFixPersonalSignMessage({ message });

    return this.backgroundApi.serviceDApp.openSignMessageModal({
      request,
      unsignedMessage: {
        type: EMessageTypesEth.PERSONAL_SIGN,
        message,
        payload: [message, address],
      },
      networkId: networkId ?? '',
      accountId: accountId ?? '',
    });
  }

  autoFixPersonalSignMessage({ message }: { message: string }) {
    let messageFixed = message;
    try {
      ethUtils.toBuffer(message);
    } catch (error) {
      const tmpMsg = `0x${message}`;
      try {
        ethUtils.toBuffer(tmpMsg);
        messageFixed = tmpMsg;
      } catch (err) {
        // message not including valid hex character
      }
    }
    return messageFixed;
  }

  @providerApiMethod()
  async wallet_switchEthereumChain(
    request: IJsBridgeMessagePayload,
    params: ISwitchEthereumChainParameter,
  ) {
    return this.switchEthereumChain(request, params);
  }

  switchEthereumChain = async (
    request: IJsBridgeMessagePayload,
    params: ISwitchEthereumChainParameter,
  ) => {
    const newNetworkId = `evm--${new BigNumber(params.chainId).toString(10)}`;
    const containsNetwork =
      await this.backgroundApi.serviceNetwork.containsNetwork({
        impls: [IMPL_EVM],
        networkId: newNetworkId,
      });
    if (!containsNetwork) {
      // https://uniswap-v3.scroll.io/#/swap required Error response
      throw web3Errors.provider.custom({
        code: 4902, // error code should be 4902 here
        message: `Unrecognized chain ID ${params.chainId}. Try adding the chain using wallet_addEthereumChain first.`,
      });
    }
    await this.backgroundApi.serviceDApp.switchConnectedNetwork({
      origin: request.origin ?? '',
      scope: request.scope ?? this.providerName,
      newNetworkId,
    });
    return null;
  };
}

export default ProviderApiEthereum;
