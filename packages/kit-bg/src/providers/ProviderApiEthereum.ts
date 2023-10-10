/* eslint-disable @typescript-eslint/lines-between-class-members, lines-between-class-members, max-classes-per-file, camelcase, @typescript-eslint/no-unused-vars */

import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';
import BigNumber from 'bignumber.js';
import * as ethUtils from 'ethereumjs-util';
import stringify from 'fast-json-stable-stringify';
import { get, isNil } from 'lodash';
import uuid from 'react-native-uuid';

// import { ETHMessageTypes } from '@onekeyhq/engine/src/types/message';
import { ETHMessageTypes } from '@onekeyhq/engine/src/types/message';
import type {
  EvmExtraInfo,
  Network,
  SwitchRpcParams,
} from '@onekeyhq/engine/src/types/network';
import type VaultEvm from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import type {
  IEncodedTxEvm,
  IUnsignedMessageEvm,
} from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import { getActiveWalletAccount } from '@onekeyhq/kit/src/hooks';
import {
  backgroundClass,
  permissionRequired,
  providerApiMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';
import {
  fixAddressCase,
  toBigIntHex,
} from '@onekeyhq/shared/src/engine/engineUtils';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import type {
  AddEthereumChainParameter,
  SwitchEthereumChainParameter,
  WatchAssetParameters,
} from '@onekeyhq/shared/src/providerApis/ProviderApiEthereum/ProviderApiEthereum.types';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';

import ProviderApiBase from './ProviderApiBase';

import type { IProviderBaseBackgroundNotifyInfo } from './ProviderApiBase';
import type {
  IJsBridgeMessagePayload,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';
import type { IUpdateChainParams } from '@walletconnect/types';

function convertToEthereumChainResult(result: Network | undefined | null) {
  return {
    id: result?.id,
    impl: result?.impl,
    symbol: result?.symbol,
    decimals: result?.decimals,
    logoURI: result?.logoURI,
    shortName: result?.shortName,
    shortCode: result?.shortCode,
    chainId: result?.extraInfo?.chainId,
    networkVersion: result?.extraInfo?.networkVersion,
  };
}

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

  async _getCurrentUnlockState() {
    return Promise.resolve(true);
  }

  _getCurrentNetworkExtraInfo(): EvmExtraInfo {
    const { network } = getActiveWalletAccount();
    // return a mocked chainId in non-evm, as empty string may cause dapp error
    let networkInfo: EvmExtraInfo = {
      chainId: '0x736d17dc',
      networkVersion: '1936529372',
    };
    if (network && network.impl === IMPL_EVM) {
      networkInfo = network.extraInfo as EvmExtraInfo;
    }
    return networkInfo;
  }

  async _showSignMessageModal(
    request: IJsBridgeMessagePayload,
    unsignedMessage: IUnsignedMessageEvm,
  ) {
    const result = await this.backgroundApi.serviceDapp?.openSignAndSendModal(
      request,
      {
        unsignedMessage,
      },
    );
    return result;
  }

  public async rpcCall(request: IJsonRpcRequest): Promise<any> {
    const { networkId, networkImpl } = getActiveWalletAccount();

    if (networkImpl !== IMPL_EVM) {
      return;
    }
    debugLogger.providerApi.info('BgApi rpcCall:', request, { networkId });
    // TODO error if networkId empty, or networkImpl not EVM
    const result = await this.backgroundApi.engine.proxyJsonRPCCall(
      networkId,
      request,
    );
    debugLogger.providerApi.info('BgApi rpcCall RESULT:', request, {
      networkId,
      result,
    });
    return result;
  }

  notifyDappAccountsChanged(info: IProviderBaseBackgroundNotifyInfo): void {
    const data = async ({ origin }: { origin: string }) => {
      const result = {
        method: 'metamask_accountsChanged',
        params: await this.eth_accounts({ origin }),
      };
      return result;
    };
    // debugLogger.providerApi.info('notifyDappAccountsChanged', data);
    info.send(data);
  }

  notifyDappChainChanged(info: IProviderBaseBackgroundNotifyInfo): void {
    const data = async () => {
      const result = {
        method: 'metamask_chainChanged',
        params: {
          chainId: await this.eth_chainId(),
          networkVersion: await this.net_version(),
        },
      };
      return result;
    };

    info.send(data);
  }

  // ----------------------------------------------
  /**
   * Depends on the data we have, show contract call or send confirm modal to the user
   * Open @type {import("@onekeyhq/kit/src/views/DappModals/Multicall.tsx").default} contract modal
   * Open @type {import("@onekeyhq/kit/src/views/DappModals/SendConfirm.tsx").default} send modal
   * Open @type {import("@onekeyhq/kit/src/views/DappModals/Approve.tsx").default} approve modal
   *
   * Example:
   * const result = await ethereum.request({
   *    method: 'eth_sendTransaction',
   *    params: [
   *      {
   *        from: accounts[0],
   *        to: '0x0c54FcCd2e384b4BB6f2E405Bf5Cbc15a017AaFb',
   *        value: '0x0',
   *        gasLimit: '0x5028',
   *        gasPrice: '0x2540be400',
   *        type: '0x0',
   *      },
   *    ],
   *  });
   */
  @permissionRequired()
  @providerApiMethod()
  async eth_sendTransaction(
    request: IJsBridgeMessagePayload,
    transaction: IEncodedTxEvm,
  ) {
    // TODO check tx from address match current account
    debugLogger.providerApi.info('eth_sendTransaction', request, transaction);
    // Parse transaction
    // const { from, to, value, gasLimit, gasPrice, data, nonce, type } =
    //   transaction;

    if (!isNil(transaction.value)) {
      transaction.value = prefixTxValueToHex(transaction.value);
    }

    const nonceBN = new BigNumber(transaction.nonce ?? 0);

    // https://app.chainspot.io/
    // some dapp may send tx with incorrect nonce 0
    if (nonceBN.isNaN() || nonceBN.isLessThanOrEqualTo(0)) {
      delete transaction.nonce;
    }

    const result = await this.backgroundApi.serviceDapp?.openSignAndSendModal(
      request,
      {
        encodedTx: transaction,
      },
    );

    debugLogger.providerApi.info(
      'eth_sendTransaction DONE',
      result,
      request,
      transaction,
    );

    return result;
  }

  /**
   * Add token to user wallet
   * const result = await window.ethereum.request({
   *   method: 'wallet_watchAsset',
   *   params: {
   *     type: 'ERC20',
   *     options: {
   *       address: contract.address,
   *       symbol: _tokenSymbol,
   *       decimals: _decimalUnits,
   *       image: 'https://metamask.github.io/test-dapp/metamask-fox.svg',
   *     },
   *   },
   * });
   */
  @permissionRequired()
  @providerApiMethod()
  async wallet_watchAsset(
    request: IJsBridgeMessagePayload,
    params: WatchAssetParameters,
  ) {
    const type = params.type ?? '';
    if (type !== 'ERC20') {
      throw new Error(`Asset of type '${type}' not supported`);
    }
    const result = await this.backgroundApi.serviceDapp?.openAddTokenModal(
      request,
      params,
    );
    return result;
  }

  // Not gonna do in this schedule but this method allow us to open ConnectionModal when connected account has cached
  // Select permitted accounts, update permissions and return accounts as result to DApp
  @providerApiMethod()
  async wallet_requestPermissions(
    request: IJsBridgeMessagePayload,
    permissions: Record<string, unknown>,
  ) {
    type Permission = {
      caveats: {
        type: string;
        value: string[];
      }[];
      // timestamp
      date: number;
      // Like a uuid
      id: string;
      // origin of the request
      invoker?: string;
      parentCapability: string;
    };

    const permissionRes =
      await this.backgroundApi.serviceDapp?.openConnectionModal(request);

    const result: Permission[] = Object.keys(permissions).map(
      (permissionName) => {
        if (permissionName === 'eth_accounts') {
          return {
            caveats: [
              {
                type: 'restrictReturnedAccounts',
                value: permissionRes as string[],
              },
            ],
            date: Date.now(),
            // TODO: Use new uuid?
            id: request.id?.toString() ?? (uuid.v4() as string),
            invoker: request.origin,
            parentCapability: permissionName,
          };
        }
        // other permissions
        return {
          caveats: [],
          date: Date.now(),
          id: request.id?.toString() ?? (uuid.v4() as string),
          invoker: request.origin,
          parentCapability: permissionName,
        };
      },
    );

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
        parentCapability: 'eth_accounts',
      },
    ];
    return Promise.resolve(result);
  }

  @providerApiMethod()
  async eth_requestAccounts(request: IJsBridgeMessagePayload) {
    debugLogger.providerApi.info(
      'ProviderApiEthereum.eth_requestAccounts',
      request,
    );

    const accounts = await this.eth_accounts(request);
    if (accounts && accounts.length) {
      return accounts;
    }

    await this.backgroundApi.serviceDapp.openConnectionModal(request);
    return this.eth_accounts(request);

    // TODO show approval confirmation, skip in whitelist domain
  }

  @providerApiMethod()
  async eth_coinbase(request: IJsBridgeMessagePayload): Promise<string | null> {
    const accounts = await this.eth_accounts(request);
    return accounts?.[0] || null;
  }

  @providerApiMethod()
  async eth_accounts(request: IJsBridgeMessagePayload) {
    const accounts = this.backgroundApi.serviceDapp?.getActiveConnectedAccounts(
      {
        origin: request.origin as string,
        impl: IMPL_EVM,
      },
    );
    if (!accounts) {
      return Promise.resolve([]);
    }
    const accountAddresses = accounts.map((account) => account.address);
    return Promise.resolve(accountAddresses);
  }

  /** Sign transaction
   * Open @type {import("@onekeyhq/kit/src/views/DappModals/Signature.tsx").default} modal
   */
  @providerApiMethod()
  eth_signTransaction(req: IJsBridgeMessagePayload, ...params: string[]) {
    throw web3Errors.provider.unsupportedMethod();
  }

  @providerApiMethod()
  eth_subscribe() {
    throw web3Errors.rpc.methodNotSupported();
  }

  @providerApiMethod()
  eth_unsubscribe() {
    throw web3Errors.rpc.methodNotSupported();
  }

  /** Sign unapproved message
   * Open @type {import("@onekeyhq/kit/src/views/DappModals/Signature.tsx").default} modal
   * arg req: IJsBridgeMessagePayload, ...[msg, from, passphrase]
   */
  @providerApiMethod()
  eth_sign(req: IJsBridgeMessagePayload, ...messages: any[]) {
    return this._showSignMessageModal(req, {
      type: ETHMessageTypes.ETH_SIGN,
      message: messages[1],
      payload: messages,
    });
  }

  /*
  const wait = (ms) =>
    new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  const testCase = [
      ['test sample','test sample'],
      [
        '0x4578616d706c652060706572736f6e616c5f7369676e60206d657373616765',
        '0x84abfa0d0ce78c9ae22416ccbd38e8c5e7ef21b7a97e3e6cce378397485ed7037dc7f93837d488461a23c50ecc43eb6904e53afa6b124452e8a77c81111ab4991b',
      ],
      [
        'haha',
        '0x8d97f86bc49dd442df3f359e0901223a6b45ebbddfb0ac3729326315a98e3ba81b7a416895dfa82ed1fe096b61741f1df6ca6e535a608f27e05cb1b8013e3ee11c',
      ],
      [
        'cabbed',
        "0x00a4985e1544bf9f8b01ddd34bd9f0bd64e47644ca65347beb6f010a02ad4299761cd7911879de17fa64f06462c9950c03595cc6fbaaf769719230ba2125b5261c",
      ],
      [
        '66726f6d206469643a20361efca9bfb910883594e6c3a5461ef66c11df7c61cc030bad3eb12821386d86',
        '0xe83f6a9c5015d602720af5ed0af0e2e388427efa26bc3a4abd426624598bcaaa7282764c44d33f26b662f0cca28b56e36175f9e3053a56cbf58e98dff66d15841b',
      ],
      [
        '66726f6d206469643a20361efca9bfb910883594e6c3a5461ef6',
        '0x59821bb2aa19c10ca4719017686f129d8e51d8a51018142f804cb492c26fe4dd2e799495e857cd2c343a556b49c80b895e7aac25673b77bd5550ae6067ea64511b',
      ],
      [
        '66726f6d206469643a20361efca9bfb910883594e6c3a5461ef6i',
        '0x3a7fa998d6c17dc7f0c0d152dedbf86716df839afaa33213d33a72773da6b00f18942a4612aaeb3eb15cff8cf75addea5065d20e74c7ade0ac78e0da1386d6761c',
      ],
      [
        'abc',
        '0x996b1f8b9d16ea57b694820054d76125972f61ffbb51e1564230f098e809cdbb27fffc0164b73f93a3d9da6a495bde925827d28898785583d10aea90cf84db421b',
      ],
      [
        'ab',
        '0x03a8c966ffa96f0af82f42f7072ae67e2dace29f7079303d7903adeee3bde17963abde5567db962f05afa3dfebcb22aa425f5cba0d26872c13ad0c5cefce1fce1c',
      ],
      [
        'a',
        '0xdad5adb51627b58b1f55d4957d9be2605c6baf93eb79ce8c4d98e7e854688bad5cd1400d9c1d2cafeb6ca5f4851f8a0c99e773d4353fefc1e3325b0dbfc9634b1b',
      ],
      [
        'abz',
        '0xa3fb77c66015ef3a052026e9aa9550c7853623c15cb30aec0ea94d36ae3bba9271b97f96b5b544ab3a3a5b5bb46513d44c589472eec5824a531b1f03fd7a34b11b',
      ],
    ];
    const address = window.ethereum._state.accounts[0];
    for (const caseInfo of testCase) {
      const [message, signedExpect] = caseInfo;
      const signedActual = await window.ethereum.request({
        method: 'personal_sign',
        params: [message, address, 'HelloWorld'],
      });
      const logInfo = {
        message,
        signedActual,
        signedExpect,
      };
      if (signedActual !== signedExpect) {
        console.error('personal_sign ERROR: ', logInfo);
      } else {
        console.info('personal_sign Success: ', logInfo);
      }
      // await wait(1000); // TODO remove in future
    }
   */
  @providerApiMethod()
  async personal_sign(req: IJsBridgeMessagePayload, ...messages: any[]) {
    let message = messages[0] as string;
    let from = messages[1] as string;

    const accounts = await this.eth_accounts(req);
    // FIX:  dydx, kava evm use second param as message
    if (accounts && accounts.length) {
      const a = fixAddressCase({
        impl: IMPL_EVM,
        address: messages[0] || '',
      });
      const b = fixAddressCase({
        impl: IMPL_EVM,
        address: accounts[0] || '',
      });
      if (a && a === b && messages[1]) {
        message = messages[1] as string;
        from = messages[0] as string;
      }
    }

    message = this.autoFixPersonalSignMessage({ message });

    return this._showSignMessageModal(req, {
      type: ETHMessageTypes.PERSONAL_SIGN,
      message,
      payload: [message, from],
    });
  }

  autoFixPersonalSignMessage({ message }: { message: string }) {
    let messageFixed = message;
    try {
      ethUtils.toBuffer(message);
    } catch (error) {
      // message not prefixed by 0x
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
  async personal_ecRecover(
    req: IJsBridgeMessagePayload,
    ...messages: string[]
  ) {
    const [message, signature] = messages;
    if (
      typeof message === 'string' &&
      typeof signature === 'string' &&
      // Signature is 65-bytes in length, length of its hexstring is 132.
      signature.length === 132
    ) {
      const { networkId } = getActiveWalletAccount();
      // Not interacting with user's credential, only a static method, so any
      // vault would do.
      const evmWatchVault =
        await this.backgroundApi.engine.vaultFactory.getChainOnlyVault(
          networkId,
        );
      const result = await (evmWatchVault as VaultEvm).personalECRecover(
        message,
        signature,
      );

      return result;
    }
    throw web3Errors.rpc.invalidParams(
      'personal_ecRecover requires a message and a 65 bytes signature.',
    );
  }

  async isEthAddress(address: string | null) {
    const result = await this.backgroundApi.getState();
    const networkId = get(result, 'state.general.activeNetworkId', null);

    if (!networkId || !address) {
      return false;
    }

    try {
      await this.backgroundApi.validator.validateAddress(networkId, address);
      return true;
    } catch {
      return false;
    }
  }

  @providerApiMethod()
  async eth_signTypedData(req: IJsBridgeMessagePayload, ...messages: any[]) {
    /**
     * Verify and switch the order as needed to ensure maximum compatibility with DApps
     */
    let message;
    if (messages.length && messages[0]) {
      message = messages[0] ?? null;
      if (await this.isEthAddress(messages[0] ?? null)) {
        message = messages[1] ?? null;
      }
    }

    let parsedData = message;
    try {
      parsedData = typeof message === 'string' && JSON.parse(message);
      // eslint-disable-next-line no-empty
    } catch {}

    /**
     * v1: basic type
     * v3: has types / primaryType / domain
     * v4: Same as V3, but also supports arrays and recursive structures.
     * Because V4 is backward compatible with V3, we only support V4
     */
    const { types, primaryType, domain } = parsedData;
    let ethMessageType = ETHMessageTypes.TYPED_DATA_V1;
    if (typeof parsedData === 'object' && (types || primaryType || domain)) {
      ethMessageType = ETHMessageTypes.TYPED_DATA_V4;
    }

    // Convert to a JSON string
    let messageStr = message;
    if (typeof message === 'object') {
      messageStr = JSON.stringify(message);
    }
    return this._showSignMessageModal(req, {
      type: ethMessageType,
      message: messageStr,
      payload: messages,
    });
  }

  @providerApiMethod()
  eth_signTypedData_v1(req: IJsBridgeMessagePayload, ...messages: any[]) {
    // @ts-ignore
    return this.eth_signTypedData(req, ...messages);
  }

  @providerApiMethod()
  eth_signTypedData_v3(req: IJsBridgeMessagePayload, ...messages: any[]) {
    console.log('eth_signTypedData_v3', messages, req);
    return this._showSignMessageModal(req, {
      type: ETHMessageTypes.TYPED_DATA_V3,
      message: messages[1],
      payload: messages,
    });
  }

  /*

    var a={
    domain: {
      // Defining the chain aka Rinkeby testnet or Ethereum Main Net
      chainId: 1,
      // Give a user friendly name to the specific contract you are signing for.
      name: "Ether Mail",
      // If name isn't enough add verifying contract to make sure you are establishing contracts with the proper entity
      verifyingContract: "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC",
      // Just let's you know the latest version. Definitely make sure the field name is correct.
      version: "1"
    },

    // Defining the message signing data content.
    message: {
    contents: "Hello, Bob!",
    attachedMoneyInEth: 4.2,
    from: {
      name: "Cow",
      wallets: [
        "0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826",
        "0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF"
      ]
    },
    to: [
      {
        name: "Bob",
        wallets: [
          "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB",
          "0xB0BdaBea57B0BDABeA57b0bdABEA57b0BDabEa57",
          "0xB0B0b0b0b0b0B000000000000000000000000000"
        ]
      }
    ]
  },
  // Refers to the keys of the *types* object below.
  primaryType: "Mail",
    types: {
    // TODO: Clarify if EIP712Domain refers to the domain the contract is hosted on
    EIP712Domain: [
      { name: "name", type: "string" },
      { name: "version", type: "string" },
      { name: "chainId", type: "uint256" },
      { name: "verifyingContract", type: "address" }
    ],
      // Not an EIP712Domain definition
      Group: [
      { name: "name", type: "string" },
      { name: "members", type: "Person[]" }
    ],
      // Refer to PrimaryType
      Mail: [
      { name: "from", type: "Person" },
      { name: "to", type: "Person[]" },
      { name: "contents", type: "string" }
    ],
      // Not an EIP712Domain definition
      Person: [
      { name: "name", type: "string" },
      { name: "wallets", type: "address[]" }
    ]
  }
  };

  ethereum.request({method:'eth_signTypedData_v4',params: [ethereum.selectedAddress,JSON.stringify(a)]})

   */
  @providerApiMethod()
  eth_signTypedData_v4(req: IJsBridgeMessagePayload, ...messages: any[]) {
    console.log('eth_signTypedData_v4', messages, req);
    return this._showSignMessageModal(req, {
      type: ETHMessageTypes.TYPED_DATA_V4,
      message: messages[1],
      payload: messages,
    });
  }

  @providerApiMethod()
  async eth_chainId() {
    const networkExtraInfo = this._getCurrentNetworkExtraInfo();
    return Promise.resolve(networkExtraInfo.chainId);
  }

  @providerApiMethod()
  async net_version() {
    const networkExtraInfo = this._getCurrentNetworkExtraInfo();
    return Promise.resolve(networkExtraInfo.networkVersion);
  }

  @providerApiMethod()
  async metamask_getProviderState(request: IJsBridgeMessagePayload) {
    const [accounts, chainId, networkVersion, isUnlocked] = await Promise.all([
      this.eth_accounts(request),
      this.eth_chainId(),
      this.net_version(),
      this._getCurrentUnlockState(),
    ]);
    return {
      accounts,
      chainId,
      networkVersion,
      isUnlocked,
    };
  }

  // for WalletConnect method: connector.updateChain(params: IUpdateChainParams)
  @providerApiMethod()
  async wallet_updateChain(
    request: IJsBridgeMessagePayload,
    params: IUpdateChainParams,
  ) {
    debugLogger.walletConnect.info(
      'wallet_updateChain by wallet-connect',
      request,
    );
    return this.wallet_addEthereumChain(request, {
      ...params,
      chainId: toBigIntHex(new BigNumber(params.chainId)),
      nativeCurrency: {
        decimals: 18,
        ...params.nativeCurrency,
      },
      rpcUrls: [params.rpcUrl].filter(Boolean),
    });
  }

  // get and save Dapp site icon & title
  @providerApiMethod()
  metamask_sendDomainMetadata() {
    // TODO
    return {};
  }

  @providerApiMethod()
  metamask_logWeb3ShimUsage() {
    // TODO
    return {};
  }

  @providerApiMethod()
  eth_subscription() {
    // TODO
    return {};
  }

  addEthereumChain = async (
    request: IJsBridgeMessagePayload,
    params: AddEthereumChainParameter,
    address?: string,
    ...others: any[]
  ) => {
    const networks = await this.backgroundApi.serviceNetwork.fetchNetworks();
    const networkId = `evm--${parseInt(params.chainId)}`;
    const network = networks.find((n) => n.id === networkId);
    if (network) {
      const result = await this.backgroundApi.getState();
      const activeNetworkId = get(
        result,
        'state.general.activeNetworkId',
        null,
      );
      if (activeNetworkId !== networkId) {
        return this.switchEthereumChain(request, {
          chainId: params.chainId,
        });
      }
      return this.switchRpc(request, {
        name: network.name,
        networkId: network.id,
        rpcURL: params.rpcUrls?.[0] ?? '',
        logoURI: network.logoURI,
      });
    }

    const result = await this.backgroundApi.serviceDapp?.openAddNetworkModal(
      request,
      params,
    );
    // Metamask return null
    return convertToEthereumChainResult(result as any);
  };
  addEthereumChainMemo = memoizee(this.addEthereumChain.bind(this), {
    max: 1,
    maxAge: 800,
    normalizer([request, params, address, ...others]: [
      IJsBridgeMessagePayload,
      AddEthereumChainParameter,
      string,
    ]): string {
      const p = request?.data ?? [params, address, ...others];
      return stringify(p);
    },
  });

  switchRpc = async (
    request: IJsBridgeMessagePayload,
    params: SwitchRpcParams,
  ) => {
    const result = await this.backgroundApi.serviceDapp?.openSwitchRpcModal(
      request,
      params,
    );
    return convertToEthereumChainResult(result as any);
  };

  switchEthereumChain = async (
    request: IJsBridgeMessagePayload,
    params: SwitchEthereumChainParameter,
  ) => {
    const networks = await this.backgroundApi.serviceNetwork.fetchNetworks();
    const networkId = `evm--${parseInt(params.chainId)}`;
    const included = networks.some((network) => network.id === networkId);
    if (!included) {
      // https://uniswap-v3.scroll.io/#/swap required Error response
      throw web3Errors.provider.custom({
        code: 4902, // error code should be 4902 here
        message: `Unrecognized chain ID ${params.chainId}. Try adding the chain using wallet_addEthereumChain first.`,
      });
    }

    const { network } = getActiveWalletAccount();
    if (params.chainId === network?.extraInfo?.chainId) {
      return convertToEthereumChainResult(network);
    }

    const result = await this.backgroundApi.serviceDapp?.openSwitchNetworkModal(
      request,
      params,
    );
    // Metamask return null
    return convertToEthereumChainResult(result as any);
  };

  switchEthereumChainMemo = memoizee(this.switchEthereumChain.bind(this), {
    max: 1,
    maxAge: 800,
    normalizer([request, params]: [
      IJsBridgeMessagePayload,
      SwitchEthereumChainParameter,
    ]): string {
      const p = request?.data ?? [params];
      return stringify(p);
    },
  });

  /**
   * Add new chain to wallet and switch to it, we also need a request modal UI
   * req: IJsBridgeMessagePayload,
   {
      chainId='0xf00',
      chainName = null,
      blockExplorerUrls = null,
      nativeCurrency = null,
      rpcUrls,
    },
   */
  @providerApiMethod()
  async wallet_addEthereumChain(
    request: IJsBridgeMessagePayload,
    params: AddEthereumChainParameter,
    address?: string,
    ...others: any[]
  ) {
    // some dapp will call methods many times, like https://beta.layer3.xyz/bounties/dca-into-mean

    // @ts-ignore
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    if (this.addEthereumChainMemo._has(request, params, address, ...others)) {
      /*
       code:-32002
       message:"Request of type 'wallet_addEthereumChain' already pending for origin https://beta.layer3.xyz. Please wait."
      */
      throw web3Errors.rpc.resourceUnavailable({
        message: `Request of type 'wallet_addEthereumChain' already pending for origin ${
          request?.origin || ''
        }. Please wait.`,
      });
    }

    // **** should await return
    await this.addEthereumChainMemo(request, params, address, ...others);

    // Metamask return null
    return null;
  }

  /**
   * Add switch to a chain, we also need a request modal UI
   * req: IJsBridgeMessagePayload, { chainId }
   */
  @providerApiMethod()
  async wallet_switchEthereumChain(
    request: IJsBridgeMessagePayload,
    params: SwitchEthereumChainParameter,
  ) {
    // @ts-ignore
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    if (this.switchEthereumChainMemo._has(request, params)) {
      /*
       code:-32002
       message:"Request of type 'wallet_switchEthereumChain' already pending for origin https://beta.layer3.xyz. Please wait."
      */
      throw web3Errors.rpc.resourceUnavailable({
        message: `Request of type 'wallet_switchEthereumChain' already pending for origin ${
          request?.origin || ''
        }. Please wait.`,
      });
    }

    // some dapp will call methods many times, like https://beta.layer3.xyz/bounties/dca-into-mean
    // some dapp should wait this method response, like https://app.uniswap.org/#/swap
    // **** should await return
    await this.switchEthereumChainMemo(request, params);

    // Metamask return null
    return null;
  }

  // TODO metamask_unlockStateChanged

  // TODO throwMethodNotFound
}

export default ProviderApiEthereum;
