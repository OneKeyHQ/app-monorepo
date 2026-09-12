import { useMemo } from 'react';

import { EFirmwareType } from '@onekeyfe/hd-shared';
import { Image, Platform } from 'react-native';

import { useTheme } from '@onekeyhq/components';
import { buildOptimizedImageSource } from '@onekeyhq/components/src/primitives/Image/optimization';
import { getWalletAvatarProvider } from '@onekeyhq/kit/src/components/WalletAvatar/getWalletAvatarProvider';
import type {
  IDBAccount,
  IDBExternalAccount,
  IDBIndexedAccount,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ANDROID_PACKAGE_NAME } from '@onekeyhq/shared/src/config/appConfig';
import { presetNetworksMap } from '@onekeyhq/shared/src/config/presetNetworks';
import { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { AllWalletAvatarImages } from '@onekeyhq/shared/src/utils/avatarUtils';
import externalWalletLogoUtils from '@onekeyhq/shared/src/utils/externalWalletLogoUtils';

import type {
  ImageSource,
  LeadingVisual,
  NativeListTheme,
} from '@onekeyfe/react-native-native-list';
import type { ImageSourcePropType } from 'react-native';

export function useAccountSelectorNativeListThemeV2(
  sidebar = false,
): NativeListTheme {
  const theme = useTheme();
  return useMemo(
    () => ({
      background: sidebar ? theme.bgSubdued.val : theme.bgApp.val,
      rowBackground: sidebar ? theme.bgSubdued.val : theme.bgApp.val,
      rowSelectedBackground: theme.bgActive.val,
      rowPressedBackground: theme.bgActive.val,
      subduedBackground: theme.bgSubdued.val,
      strongBackground: theme.bgStrong.val,
      primaryText: theme.text.val,
      secondaryText: theme.textSubdued.val,
      disabledText: theme.textDisabled.val,
      icon: theme.icon.val,
      iconSubdued: theme.iconSubdued.val,
      separator: theme.borderSubdued.val,
      accent: theme.iconActive.val,
      positive: theme.textSuccess.val,
      negative: theme.textCritical.val,
      inverseBackground: theme.bgInverse.val,
      inverseText: theme.textInverse.val,
      info: theme.textInfo.val,
      caution: theme.textCaution.val,
      cautionBackground: theme.bgCautionSubdued.val,
    }),
    [sidebar, theme],
  );
}

export function accountSelectorAssetUriV2(
  source: ImageSourcePropType | string,
): string {
  if (typeof source === 'string') return source;
  const uri = Image.resolveAssetSource(source)?.uri ?? '';
  if (Platform.OS === 'android' && uri && !uri.includes(':')) {
    return `android.resource://${ANDROID_PACKAGE_NAME}/drawable/${uri}`;
  }
  return uri;
}

function accountSelectorRemoteImageV2(uri: string, size: number) {
  const optimized = platformEnv.isNative
    ? undefined
    : buildOptimizedImageSource({
        source: { uri },
        resolvedSource: { uri },
        width: size,
        height: size,
        allowRelativeUrl: platformEnv.isWeb || platformEnv.isWebEmbed,
      });
  return {
    uri: optimized?.source?.uri ?? uri,
    width: size,
    height: size,
    retryTimes: 1,
    ...(optimized?.optimized ? { fallbackUri: optimized.rawUri } : {}),
  };
}

export function accountSelectorWalletVisualV2({
  wallet,
  connected,
  badge,
  badgeBackground,
  connectionColor,
  theme,
}: {
  wallet: IDBWallet;
  connected?: boolean;
  badge?: string | number;
  badgeBackground: string;
  connectionColor: string;
  theme: NativeListTheme;
}): LeadingVisual {
  const overlays: NonNullable<
    Extract<LeadingVisual, { kind: 'wallet' }>['overlays']
  >[number][] = [];
  if (wallet.firmwareTypeAtCreated === EFirmwareType.BitcoinOnly) {
    overlays.push({
      position: 'topLeft',
      width: 18,
      height: 16,
      padding: 1,
      offsetX: 0,
      offsetY: 4,
      image: {
        ...accountSelectorRemoteImageV2(presetNetworksMap.btc.logoURI, 14),
        contentFit: 'contain',
      },
    });
  }
  let name: string | undefined;
  if (accountUtils.isBotWallet({ walletId: wallet.id })) name = 'BotIllus';
  else if (wallet.isKeyless) {
    name =
      getWalletAvatarProvider(wallet) === EOAuthSocialLoginProvider.Google
        ? 'GoogleIllus'
        : 'AppleBrand';
  } else if (connected) name = 'Circle';
  if (name || badge !== undefined) {
    let size: number | undefined;
    let tintColor = theme.primaryText;
    if (name) {
      size = 18;
      tintColor = theme.icon ?? theme.primaryText;
    }
    if (name === 'Circle') {
      size = 14;
      tintColor = connectionColor;
    } else if (name === 'AppleBrand') {
      tintColor = theme.accent;
    }
    overlays.push({
      position: 'bottomRight',
      size,
      height: name ? undefined : 16,
      padding: name ? 2 : undefined,
      offsetX: name ? 2 : 1,
      offsetY: 2,
      name,
      text: name ? undefined : String(badge),
      tintColor,
      backgroundColor:
        name && name !== 'Circle' ? badgeBackground : theme.subduedBackground,
    });
  }
  if (accountUtils.isHwHiddenWallet({ wallet })) {
    return {
      kind: 'wallet',
      backgroundColor: '#00000000',
      fallbackIcon: { name: 'LockSolid', tintColor: theme.icon },
      overlays,
    };
  }
  const imageName = wallet.avatarInfo?.img;
  return {
    kind: 'wallet',
    shape: 'square',
    backgroundColor: '#00000000',
    image: imageName
      ? {
          uri: accountSelectorAssetUriV2(
            AllWalletAvatarImages[imageName] ?? AllWalletAvatarImages.bear,
          ),
          width: 40,
          height: 40,
          contentFit: 'cover',
          retryTimes: 1,
        }
      : undefined,
    fallbackText: wallet.avatarInfo?.emoji ?? '',
    overlays,
  };
}

export function accountSelectorAccountImageSourceV2({
  account,
  indexedAccount,
}: {
  account?: IDBAccount;
  indexedAccount?: IDBIndexedAccount;
}): ImageSource | undefined {
  let uri: string | undefined;
  if (account && accountUtils.isExternalAccount({ accountId: account.id })) {
    const external = account as IDBExternalAccount;
    const peerMeta = external.connectionInfo?.walletConnect?.peerMeta;
    const externalLogo =
      (peerMeta
        ? externalWalletLogoUtils.getLogoInfoFromWalletConnect({ peerMeta })
            .logo
        : undefined) ||
      external.connectionInfo?.evmEIP6963?.info?.icon ||
      external.connectionInfo?.evmInjected?.icon ||
      peerMeta?.icons?.[0] ||
      (external.connectionInfo?.walletConnect
        ? externalWalletLogoUtils.getLogoInfo('walletconnect').logo
        : undefined);
    uri = externalLogo ? accountSelectorAssetUriV2(externalLogo) : undefined;
  }
  if (!uri) {
    const seed = (
      indexedAccount?.idHash ||
      indexedAccount?.id ||
      account?.address ||
      ''
    ).replaceAll(':', '');
    if (seed) {
      // The image loader owns generation and persistent caching, outside row construction.
      uri = `onekey-avatar://blockie/v1/${encodeURIComponent(seed.toLowerCase())}`;
    }
  }
  return uri
    ? { uri, width: 32, height: 32, contentFit: 'contain', retryTimes: 1 }
    : undefined;
}

export function accountSelectorAccountVisualV2({
  account,
  indexedAccount,
  network,
  theme,
}: {
  account?: IDBAccount;
  indexedAccount?: IDBIndexedAccount;
  network?: {
    logoURI?: string;
    isCustomNetwork?: boolean;
    isAllNetworks?: boolean;
    name?: string;
  };
  theme: NativeListTheme;
}): LeadingVisual {
  return {
    kind: 'account',
    shape: 'rounded',
    image: accountSelectorAccountImageSourceV2({ account, indexedAccount }),
    backgroundColor: theme.strongBackground,
    fallbackIcon: {
      name:
        account && accountUtils.isExternalAccount({ accountId: account.id })
          ? 'AccountErrorCustom'
          : 'CrossedSmallSolid',
      tintColor: theme.secondaryText,
    },
    overlays: network
      ? [
          {
            position: 'bottomRight',
            size: 20,
            padding: 2,
            offset: 4,
            backgroundColor: theme.rowBackground,
            image:
              !network.isCustomNetwork &&
              !network.isAllNetworks &&
              network.logoURI
                ? accountSelectorRemoteImageV2(network.logoURI, 16)
                : undefined,
            text: network.isCustomNetwork ? network.name?.[0] : undefined,
            name: network.isAllNetworks ? 'AllNetworksSolid' : undefined,
          },
        ]
      : undefined,
  };
}
