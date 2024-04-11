import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';
import BigNumber from 'bignumber.js';
import * as ethUtils from 'ethereumjs-util';
import { isNil } from 'lodash';

import { hashMessage } from '@onekeyhq/core/src/chains/evm/message';
import type { IEncodedTxEvm } from '@onekeyhq/core/src/chains/evm/types';
import {
  backgroundClass,
  permissionRequired,
  providerApiMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';
import { check } from '@onekeyhq/shared/src/utils/assertUtils';
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
  public async rpcCall(request: IJsBridgeMessagePayload): Promise<any> {
    const { data } = request;
    const { accountInfo: { networkId } = {} } = (
      await this._getAccountsInfo(request)
    )[0];
    const rpcRequest = data as IJsonRpcRequest;

    console.log(`${this.providerName} RpcCall=====>>>> : BgApi:`, request);

    const result = await this.backgroundApi.serviceDApp.proxyRPCCall({
      networkId: networkId ?? '',
      request: rpcRequest,
    });

    return result;
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
    await this.backgroundApi.serviceDApp.openConnectionModal(request);
    const accounts = await this.eth_accounts(request);
    const result = Object.keys(permissions).map((permissionName) => {
      if (permissionName === 'eth_accounts') {
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
  async metamask_getProviderState(request: IJsBridgeMessagePayload) {
    const [accounts, chainId, networkVersion, isUnlocked] = await Promise.all([
      this.eth_accounts(request),
      this.eth_chainId(request),
      this.net_version(request),
      this._getCurrentUnlockState(),
    ]);
    return {
      accounts,
      chainId,
      networkVersion,
      isUnlocked,
    };
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
    const { accountInfo: { accountId, networkId } = {} } = (
      await this._getAccountsInfo(request)
    )[0];

    if (!isNil(transaction.value)) {
      transaction.value = prefixTxValueToHex(transaction.value);
    }

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
  async wallet_watchAsset() {
    throw web3Errors.rpc.methodNotSupported();
  }

  @providerApiMethod()
  async eth_sign(request: IJsBridgeMessagePayload, ...messages: any[]) {
    const { accountInfo: { accountId, networkId } = {} } = (
      await this._getAccountsInfo(request)
    )[0];
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
    const {
      accountInfo: { accountId, networkId, address: accountAddress } = {},
    } = (await this._getAccountsInfo(request))[0];

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
    const [message, signature] = messages;
    if (
      typeof message === 'string' &&
      typeof signature === 'string' &&
      signature.length === 132
    ) {
      const result = await this._personalECRecover(
        { type: EMessageTypesEth.PERSONAL_SIGN, message },
        signature,
      );

      return result;
    }
    throw web3Errors.rpc.invalidParams(
      'personal_ecRecover requires a message and a 65 bytes signature.',
    );
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
  async eth_signTypedData(
    request: IJsBridgeMessagePayload,
    ...messages: any[]
  ) {
    const { accountInfo: { accountId, networkId } = {} } = (
      await this._getAccountsInfo(request)
    )[0];

    let message;
    if (messages.length && messages[0]) {
      message = messages[0] ?? null;
      if (
        await this._isValidAddress({
          networkId: networkId ?? '',
          address: message,
        })
      ) {
        message = messages[1] ?? null;
      }
    }

    let parsedData = message;
    try {
      parsedData = typeof message === 'string' && JSON.parse(message);
      // eslint-disable-next-line no-empty
    } catch {}

    const { types, primaryType, domain } = parsedData;
    let ethMessageType = EMessageTypesEth.TYPED_DATA_V1;
    if (typeof parsedData === 'object' && (types || primaryType || domain)) {
      ethMessageType = EMessageTypesEth.TYPED_DATA_V4;
    }

    // Convert to a JSON string
    let messageStr = message;
    if (typeof message === 'object') {
      messageStr = JSON.stringify(message);
    }

    return this.backgroundApi.serviceDApp.openSignMessageModal({
      request,
      unsignedMessage: {
        type: ethMessageType,
        message: messageStr,
        payload: messages,
      },
      networkId: networkId ?? '',
      accountId: accountId ?? '',
    });
  }

  @providerApiMethod()
  async eth_signTypedData_v1(
    request: IJsBridgeMessagePayload,
    ...messages: any[]
  ) {
    console.log('eth_signTypedData_v1', messages, request);
    return this.eth_signTypedData(request, ...messages);
  }

  @providerApiMethod()
  async eth_signTypedData_v3(
    request: IJsBridgeMessagePayload,
    ...messages: any[]
  ) {
    const { accountInfo: { accountId, networkId } = {} } = (
      await this._getAccountsInfo(request)
    )[0];
    console.log('eth_signTypedData_v3', messages, request);
    return this.backgroundApi.serviceDApp.openSignMessageModal({
      request,
      unsignedMessage: {
        type: EMessageTypesEth.TYPED_DATA_V3,
        message: messages[1],
        payload: messages,
      },
      networkId: networkId ?? '',
      accountId: accountId ?? '',
    });
  }

  @providerApiMethod()
  async eth_signTypedData_v4(
    request: IJsBridgeMessagePayload,
    ...messages: any[]
  ) {
    const { accountInfo: { accountId, networkId } = {} } = (
      await this._getAccountsInfo(request)
    )[0];
    console.log('eth_signTypedData_v4', messages, request);
    return this.backgroundApi.serviceDApp.openSignMessageModal({
      request,
      unsignedMessage: {
        type: EMessageTypesEth.TYPED_DATA_V4,
        message: messages[1],
        payload: messages,
      },
      networkId: networkId ?? '',
      accountId: accountId ?? '',
    });
  }

  @providerApiMethod()
  async wallet_switchEthereumChain(
    request: IJsBridgeMessagePayload,
    params: ISwitchEthereumChainParameter,
  ) {
    return this._switchEthereumChain(request, params);
  }

  _switchEthereumChain = async (
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

  _isValidAddress = async ({
    networkId,
    address,
  }: {
    networkId: string;
    address: string;
  }) => {
    try {
      const status =
        await this.backgroundApi.serviceAccountProfile.validateAddress({
          networkId,
          address,
        });
      return status === 'valid';
    } catch {
      return false;
    }
  };

  _getAccountsInfo = async (request: IJsBridgeMessagePayload) => {
    const accountsInfo =
      await this.backgroundApi.serviceDApp.dAppGetConnectedAccountsInfo(
        request,
      );
    if (!accountsInfo) {
      throw web3Errors.provider.unauthorized();
    }
    return accountsInfo;
  };

  _personalECRecover = async (
    message: {
      type: EMessageTypesEth;
      message: string;
    },
    signature: string,
  ) => {
    const messageHash = hashMessage({
      messageType: message.type,
      message: message.message,
    });
    const hashBuffer = ethUtils.toBuffer(messageHash);
    const sigBuffer = ethUtils.toBuffer(signature);
    check(hashBuffer.length === 32, 'Invalid message hash length');
    check(sigBuffer.length === 65, 'Invalid signature length');

    const [r, s, v] = [
      sigBuffer.subarray(0, 32),
      sigBuffer.subarray(32, 64),
      sigBuffer[64],
    ];
    const publicKey = ethUtils.ecrecover(hashBuffer, v, r, s);
    return ethUtils.addHexPrefix(
      ethUtils.pubToAddress(publicKey).toString('hex'),
    );
  };

  _getCurrentUnlockState = async () => Promise.resolve(true);
}

export default ProviderApiEthereum;
