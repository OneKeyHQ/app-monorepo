import { type EIP1193Provider } from 'viem';

import type { ExternalConnectorWalletConnect } from '@onekeyhq/kit-bg/src/connectors/chains/walletconnect/ExternalConnectorWalletConnect';
import type { IDBAccountAddressesMap } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { WalletConnectDappSideProvider } from '@onekeyhq/kit-bg/src/services/ServiceWalletConnect/WalletConnectDappSideProvider';

import type { Emitter } from '../src/eventBus/WagmiEventEmitter';
import type {
  IWalletConnectConnectToWalletParams,
  IWalletConnectPeerMeta,
  IWalletConnectSession,
} from '../src/walletConnect/types';
import type { ConnectorEventMap, CreateConnectorFn } from '@wagmi/core';
import type { EIP6963ProviderInfo, Rdns } from 'mipd';

export type IEvmEIP6963ProviderInfo = EIP6963ProviderInfo<Rdns>;
export type IWagmiConnectorEventMap = ConnectorEventMap;

type IWalletProviderFlags =
  | 'isApexWallet'
  | 'isAvalanche'
  | 'isBackpack'
  | 'isBifrost'
  | 'isBitKeep'
  | 'isBitski'
  | 'isBlockWallet'
  | 'isBraveWallet'
  | 'isCoinbaseWallet'
  | 'isDawn'
  | 'isEnkrypt'
  | 'isExodus'
  | 'isFrame'
  | 'isFrontier'
  | 'isGamestop'
  | 'isHyperPay'
  | 'isImToken'
  | 'isKuCoinWallet'
  | 'isMathWallet'
  | 'isMetaMask'
  | 'isOkxWallet'
  | 'isOKExWallet'
  | 'isOneInchAndroidWallet'
  | 'isOneInchIOSWallet'
  | 'isOpera'
  | 'isPhantom'
  | 'isPortal'
  | 'isRabby'
  | 'isRainbow'
  | 'isStatus'
  | 'isTally'
  | 'isTokenPocket'
  | 'isTokenary'
  | 'isTrust'
  | 'isTrustWallet'
  | 'isXDEFI'
  | 'isZerion';

type IEvaluate<type> = { [key in keyof type]: type[key] } & unknown;

export type IExternalConnectionInfoWalletConnect =
  IWalletConnectConnectToWalletParams & {
    isNewConnection?: boolean; // only for new connection, do not save to DB
    topic: string;
    peerMeta: IWalletConnectPeerMeta | undefined;
    // how to check this account is connected by deeplink redirect at same device,
    //     but not qrcode scan from another device
    //     use peerMeta?.redirect instead
    mobileLink?: string; // StorageUtil.setDeepLinkWallet(data?.wallet?.mobile_link);
  };
export type IExternalConnectionInfoEvmEIP6963 = {
  info: IEvmEIP6963ProviderInfo;
};
export type IExternalConnectionInfoEvmInjected = {
  global: 'ethereum'; // window.ethereum, nested object use `lodash.get(window, '$onekey.ethereum');`
  icon?: string;
  name: string;
};
export type IExternalConnectionInfo = {
  walletConnect?: IExternalConnectionInfoWalletConnect;
  evmEIP6963?: IExternalConnectionInfoEvmEIP6963;
  evmInjected?: IExternalConnectionInfoEvmInjected;
};

export type IExternalWalletInfo = {
  name: string;
  desc?: string;
  icon: string;
  // type: string;
  connectionInfo: IExternalConnectionInfo;
};
export type IExternalConnectResultEvm = {
  accounts: readonly `0x${string}`[];
  chainId: number;
};
export type IExternalConnectResultWalletConnect = {
  session: IWalletConnectSession;
};
export type IExternalConnectResult =
  | IExternalConnectResultEvm
  | IExternalConnectResultWalletConnect
  | undefined;
export type IExternalConnectorBase<TProvider = any> = Omit<
  ReturnType<CreateConnectorFn<TProvider>>,
  'connect'
> & {
  emitter: Emitter<ConnectorEventMap>;
  uid: string;
  connectionInfo: IExternalConnectionInfo;
  connect(
    parameters?:
      | { chainId?: number | undefined; isReconnecting?: boolean | undefined }
      | undefined,
  ): Promise<IExternalConnectResult>;
};

export type IExternalWalletProviderEvm = IEvaluate<
  EIP1193Provider & {
    [key in IWalletProviderFlags]?: true | undefined;
  } & {
    providers?: IExternalWalletProviderEvm[] | undefined;
    /** Only exists in MetaMask as of 2022/04/03 */
    _events?: { connect?: (() => void) | undefined } | undefined;
    /** Only exists in MetaMask as of 2022/04/03 */
    _state?:
      | {
          accounts?: string[];
          initialized?: boolean;
          isConnected?: boolean;
          isPermanentlyDisconnected?: boolean;
          isUnlocked?: boolean;
        }
      | undefined;
  }
>;
export type IExternalWalletProvider =
  | IExternalWalletProviderEvm
  | WalletConnectDappSideProvider;
export type IExternalConnectorEvm =
  IExternalConnectorBase<IExternalWalletProviderEvm>;
export type IExternalConnector =
  | IExternalConnectorEvm
  | ExternalConnectorWalletConnect;
export type IExternalListWalletsResult = {
  wallets: IExternalWalletInfo[];
};
export type IExternalCreateConnectorResult = {
  // provider: TProvider; // TODO remove
  connector: IExternalConnector;
  connectionInfo: IExternalConnectionInfo; // TODO remove
};
export type IExternalConnectAccountInfo = {
  createAtNetwork: string | undefined;
  networkIds: string[] | undefined;
  impl: string;
  addresses: IDBAccountAddressesMap;
  name: string;
};
export type IExternalConnectWalletResult = {
  connectionInfo: IExternalConnectionInfo;
  accountInfo: IExternalConnectAccountInfo;
  notSupportedNetworkIds: string[] | undefined;
};
