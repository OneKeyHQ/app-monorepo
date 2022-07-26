import { ComponentProps } from 'react';

// import { IAsyncStorage } from 'keyvaluestorage/dist/cjs/react-native/types.d';

import WalletConnectProviderBase from '@walletconnect/react-native-dapp';
import { Platform } from 'react-native';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';
import { ONEKEY_UNIVERSAL_LINK } from './walletConnectConsts';

const platformName = [
  process.env.ONEKEY_PLATFORM ?? '',
  process.env.EXT_CHANNEL ?? '',
  Platform.OS ?? '',
]
  .filter(Boolean)
  .join('-');

export const WALLET_CONNECT_CLIENT_META = {
  description: 'Connect with OneKey',
  // wallet-connect dapp identity
  url: `https://www.${platformName}.onekey.so`,
  icons: [
    'https://web.onekey-asset.com/portal/b688e1435d0d1e2e92581eb8dd7442c88da36049/icons/icon-256x256.png',
    'https://www.onekey.so/favicon.ico',
    // 'https://example.walletconnect.org/favicon.ico'
  ],
  name: `OneKey ${platformName}`,
};

export function WalletConnectContextProvider(
  props: ComponentProps<typeof WalletConnectProviderBase>,
) {
  return (
    <WalletConnectProviderBase
      autoConnectLastSessionOnMount
      // autoConnectLastSessionOnMount={false}
      storageId="onekey@walletconnect-dapp-side"
      bridge="https://bridge.walletconnect.org"
      clientMeta={WALLET_CONNECT_CLIENT_META}
      redirectUrl={
        platformEnv.isNative || platformEnv.isDesktop
          ? ONEKEY_UNIVERSAL_LINK
          : window.location.origin
      }
      storageOptions={{
        asyncStorage: appStorage as any,
      }}
      {...props}
    />
  );
}
