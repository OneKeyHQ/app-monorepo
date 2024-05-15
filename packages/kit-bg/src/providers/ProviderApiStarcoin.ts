/* eslint-disable @typescript-eslint/lines-between-class-members, lines-between-class-members, max-classes-per-file, camelcase, @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */

import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';
import uuid from 'react-native-uuid';

import type { IEncodedTxStc } from '@onekeyhq/core/src/chains/stc/types';
import {
  backgroundClass,
  permissionRequired,
  providerApiMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';

import ProviderApiBase from './ProviderApiBase';

import type { IProviderBaseBackgroundNotifyInfo } from './ProviderApiBase';
import type {
  IJsBridgeMessagePayload,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';

/**
 * @type Transaction
 *
 * Transaction representation
 * @property chainId - Network ID as per EIP-155
 * @property data - Data to pass with this transaction
 * @property from - Address to send this transaction from
 * @property gas - Gas to send with this transaction
 * @property gasPrice - Price of gas with this transaction
 * @property gasUsed -  Gas used in the transaction
 * @property nonce - Unique number to prevent replay attacks
 * @property to - Address to send this transaction to
 * @property value - Value associated with this transaction
 */
export interface ITransaction {
  chainId?: number;
  data?: string;
  from: string;
  to?: string;
  value?: string;
  gas?: string;
  gasLimit?: number;
  gasPrice?: number;
  nonce?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  estimatedBaseFee?: string;
  expiredSecs?: number;
}

@backgroundClass()
class ProviderApiStarcoin extends ProviderApiBase {
  public providerName = IInjectedProviderNames.starcoin;
  async _getCurrentUnlockState() {
    return Promise.resolve(true);
  }

  async _getCurrentNetworkExtraInfo(request: IJsBridgeMessagePayload) {
    // Give default value to prevent UI crashing
    let networkInfo = {
      chainId: '0x1',
      networkVersion: '1',
    };

    const result = await this.rpcCall({
      ...request,
      data: {
        id: 1,
        jsonrpc: '2.0',
        method: 'chain.id',
        params: [],
      },
    });
    const resultId = (result as { id?: number | string })?.id;
    if (resultId) {
      networkInfo = {
        chainId: `0x${resultId.toString(16)}`,
        networkVersion: resultId.toString(),
      };
    }

    return Promise.resolve(networkInfo);
  }

  public async rpcCall(request: IJsBridgeMessagePayload): Promise<any> {
    const { data } = request;
    const { accountInfo: { networkId } = {} } = (
      await this.getAccountsInfo(request)
    )[0];
    const rpcRequest = data as IJsonRpcRequest;

    console.log(`${this.providerName} RpcCall=====>>>> : BgApi:`, request);

    const [result] = await this.backgroundApi.serviceDApp.proxyRPCCall({
      networkId: networkId ?? '',
      request: rpcRequest,
    });

    return result;
  }

  notifyDappAccountsChanged(info: IProviderBaseBackgroundNotifyInfo): void {
    const data = async ({ origin }: { origin: string }) => {
      const result = {
        method: 'starmask_accountsChanged',
        params: await this.stc_accounts({ origin, scope: this.providerName }),
      };
      return result;
    };
    info.send(data, info.targetOrigin);
  }

  notifyDappChainChanged(info: IProviderBaseBackgroundNotifyInfo): void {
    const data = async ({ origin }: { origin: string }) => {
      const result = {
        method: 'starmask_chainChanged',
        params: {
          chainId: await this.eth_chainId({ origin }),
          networkVersion: await this.net_version({ origin }),
        },
      };
      return result;
    };

    info.send(data, info.targetOrigin);
  }

  @permissionRequired()
  @providerApiMethod()
  async stc_sendTransaction(
    request: IJsBridgeMessagePayload,
    transaction: IEncodedTxStc,
  ) {
    console.log('stc_sendTransaction', request, transaction);

    const { accountInfo: { accountId, networkId } = {} } = (
      await this.getAccountsInfo(request)
    )[0];

    const result =
      await this.backgroundApi.serviceDApp.openSignAndSendTransactionModal({
        request,
        encodedTx: transaction,
        accountId: accountId ?? '',
        networkId: networkId ?? '',
      });

    console.log('stc_sendTransaction DONE', result, request, transaction);

    return result;
  }

  @permissionRequired()
  @providerApiMethod()
  async wallet_watchAsset() {
    throw web3Errors.rpc.methodNotSupported();
  }

  @providerApiMethod()
  async wallet_requestPermissions(
    request: IJsBridgeMessagePayload,
    permissions: Record<string, unknown>,
  ) {
    await this.backgroundApi.serviceDApp.openConnectionModal(request);
    const accounts = await this.stc_accounts(request);
    const result = Object.keys(permissions).map((permissionName) => {
      if (permissionName === 'stc_accounts') {
        return {
          caveats: [
            {
              type: 'restrictReturnedAccounts',
              value: [accounts[0]],
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
        id: request.id?.toString() ?? (uuid.v4() as string),
        invoker: request.origin as string,
        parentCapability: 'stc_accounts',
      },
    ];
    return Promise.resolve(result);
  }

  @providerApiMethod()
  async stc_requestAccounts(request: IJsBridgeMessagePayload) {
    const accounts = await this.stc_accounts(request);
    if (accounts && accounts.length) {
      return accounts;
    }
    await this.backgroundApi.serviceDApp.openConnectionModal(request);
    return this.stc_accounts(request);
  }

  @providerApiMethod()
  async stc_coinbase(request: IJsBridgeMessagePayload): Promise<string | null> {
    const accounts = await this.stc_accounts(request);
    return accounts?.[0] || null;
  }

  @providerApiMethod()
  async stc_accounts(request: IJsBridgeMessagePayload) {
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
  stc_signTransaction(request: IJsBridgeMessagePayload, ...params: string[]) {
    throw web3Errors.rpc.methodNotSupported();
  }

  @providerApiMethod()
  stc_subscribe() {
    throw web3Errors.rpc.methodNotSupported();
  }

  @providerApiMethod()
  stc_unsubscribe() {
    throw web3Errors.rpc.methodNotSupported();
  }

  @providerApiMethod()
  stc_sign(request: IJsBridgeMessagePayload, ...messages: any[]) {
    throw web3Errors.rpc.methodNotSupported();
  }

  @providerApiMethod()
  async personal_sign(request: IJsBridgeMessagePayload, ...messages: any[]) {
    const {
      accountInfo: { accountId, networkId, address: accountAddress } = {},
    } = (await this.getAccountsInfo(request))[0];

    let message = messages[0] as string;
    let address = messages[1] as string;

    // FIX: DYDX, KAVA evm use second param as message
    if (message?.toLowerCase() === accountAddress?.toLowerCase() && address) {
      [address, message] = messages;
    }
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

  @providerApiMethod()
  async personal_ecRecover(
    request: IJsBridgeMessagePayload,
    ...messages: string[]
  ) {
    throw web3Errors.rpc.methodNotSupported();
  }

  @providerApiMethod()
  stc_signTypedData(request: IJsBridgeMessagePayload, ...messages: any[]) {
    throw web3Errors.rpc.methodNotSupported();
  }

  @providerApiMethod()
  stc_signTypedData_v1(request: IJsBridgeMessagePayload, ...messages: any[]) {
    throw web3Errors.rpc.methodNotSupported();
  }

  @providerApiMethod()
  stc_signTypedData_v3(request: IJsBridgeMessagePayload, ...messages: any[]) {
    throw web3Errors.rpc.methodNotSupported();
  }

  @providerApiMethod()
  stc_signTypedData_v4(request: IJsBridgeMessagePayload, ...messages: any[]) {
    throw web3Errors.rpc.methodNotSupported();
  }

  @providerApiMethod()
  async eth_chainId(request: IJsBridgeMessagePayload) {
    const networkExtraInfo = await this._getCurrentNetworkExtraInfo(request);
    return Promise.resolve(networkExtraInfo.chainId);
  }

  @providerApiMethod()
  async net_version(request: IJsBridgeMessagePayload) {
    const networkExtraInfo = await this._getCurrentNetworkExtraInfo(request);
    return Promise.resolve(networkExtraInfo.networkVersion);
  }

  @providerApiMethod()
  async starmask_getProviderState(request: IJsBridgeMessagePayload) {
    const networkExtraInfo = await this._getCurrentNetworkExtraInfo(request);
    return {
      accounts: await this.stc_accounts(request),
      chainId: networkExtraInfo.chainId,
      networkVersion: networkExtraInfo.networkVersion,
      isUnlocked: await this._getCurrentUnlockState(),
    };
  }

  // get and save Dapp site icon & title
  @providerApiMethod()
  starmask_sendDomainMetadata() {
    return {};
  }

  @providerApiMethod()
  starmask_logWeb3ShimUsage() {
    return {};
  }

  @providerApiMethod()
  stc_subscription() {
    return {};
  }

  @providerApiMethod()
  async wallet_addEthereumChain() {
    throw web3Errors.rpc.methodNotSupported();
  }

  @providerApiMethod()
  async wallet_switchEthereumChain() {
    throw web3Errors.rpc.methodNotSupported();
  }
}

export default ProviderApiStarcoin;
