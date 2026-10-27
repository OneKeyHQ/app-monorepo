import { useMemo } from 'react';

import { EFirmwareType } from '@onekeyfe/hd-shared';
import { colord } from 'colord';
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

// Rasterized from components/svg/custom/onekey-device.svg at 3x. Inline PNGs
// also work with the existing Android image decoder and OTA asset delivery.
const hardwareWalletFallbackImages = {
  light:
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHgAAAB4CAYAAAA5ZDbSAAADbUlEQVR42u2d4ZGbMBBGP7ALoAQ6segkqQQoJZVY7oQS6MD5cdyMjzkbg20hrd6byZ+bTHLmeRch7S4SAAAAAAAAAABAChSx/CJ1XTtJ7c2PXILX00u6SNIwDB2Cv8SeE5X5DP3eoosdxXaziLXMbqIPO0btn4xuha6qqmIcR28+go2n5MV79DAMTcj/sNwhLecqV5Lc9AW3l6Izu+c+vBQh03URUPAVtz9ohmHwJlL0FL3wk9ZEBE8bGGd87hPFxxALiw27QX2I9PWBL7KLbZ0RQvAptvvSJ5h+b1/X9Zr0205f6KTvwW7Fbk+ScmeiO0n9h7JblPfg65MXppAhYvncZYD7Uq74GK5RmdLFgHQFA4IBwYBgBAOCAcGAYEAwKIXTJEVekhu8EI4IBgQrgnIYBO9XWQGGIxjBxhdZpzvHjw7BBri3Is61LptVNIIBwYBgQDAgGBAMCEYwIBgQDGIvWgH3qAsiGIhgpV0EcFvpcZk1bSM4UbGtfj8Ldjd/r1UEg0NJ0etHJq4Zm9jWdX21NvLJZE3WdLjvNv4TrSXJFiP4HTO5zEguDabld2FCcmmsm+FRWu71NYer+P4jqVkYedSyilb0xe7+3gyuZ4aX1XXdpby6PhqKXq2pspwPL3sg+SRSdLT0KyfU+TtDvB2CI0zPG1Jrb61bosx90pw4bEiWi7ZNjEWw0ulRyr4zkeNC4w1qpeH7raNX2I7g/tWdqEdzPVLe6CgzeBFVt+HNp5uepRGsz74vYcs57/Tz88IGiNiqjKDxe6HJu50qN/yKRVUvDhuionniPNil8u5fUvTvqbp/01tCO7GKjva1Ns2LL3NueEyKPJKnA/1+5bN0Y62y8mi8m6GT1N2soE8392Bv7aVc2Ra+Wy5sZy9abFUCggHBgGBAMCAYEAwIRjDIQgFfycUggrV3A5kMNcPlnKJNNFwvFPAp99Okdmrj9Kkd3y1M9EHwrJb5WzS8SBHgm33lMmu3EYs8JrGKFn26CV+bMqYxChlyYSeLCI5b8ELfUM4EqeQsAj4jnnEafkB5mVhLSXbjnZKI4NksSUdqDlenXew0MDRXyT5039Mh9Cccx/FfVVVFhpL9Hk1thz0+6TiOPjPJ/TAMf2VxL/qV4SdErQHBvxySnxKNbJ9DtyIAAAAAAAAAAMBn+A9fEDjuI1yu0QAAAABJRU5ErkJggg==',
  dark: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHgAAAB4CAYAAAA5ZDbSAAADwElEQVR42u2dW7KiMBBAu1NuAFjQxZUBKxMXBOyAzMfFKsZSFC9C0jmnaj7m6yrHhCb9QAQAAAAAAAAAACAGNJQPMgxDKSLV7f/e+zK6i6najuN4FREpiqJG8K/YS4wy38F73xwt+jDBXdfVqlqlsE0eKVpZtbYlK3L3vUdnWXbe82+6vbflVOXeAsdhGC4mBad0z30lueu62twW3fe956n0v+36nGVZa2IF7/mLjYjKxAoehqH03l/wecwqPn37S4zjWKrqqkhTRJo9tq+tf8jTdw0qzvi6YOfcj/c+qPvSN5g+d9t1nayQXIlIG/U9+N3HIu99E6vcOUVR1N77ZstrE/Q9+N3oOc9zFUOE8r3dDhmiVAOoNoRr5GK6GBCpYEAwIBgQjGBAMCAYEAwIBokhmySBl+QeUQjHCgYEv1iVFWqNCk45g5WE4HEcEWw5yHLO/ciDMphUC+7NCX4WEadal00UjWBAMCAYEAwIBgQDghEMCAYEg3AWvRvWuhdZwZDOCp4VAVSzvPFVZk3bCI5XbPUoF6yq5SyVWIUwOJQtev3IxLfHJqpq1fe9tzbyyWRNVt/3/tMKDlWtLEl2BkcFXraoyrQi2VnblmXD0lsLkp2lboalbdl736jqOc9zvf1T1fPSyCML9dUn68Xut8l5eZ638sHwsq7r6pij65OV1SsrqyzlbnjZM8lTGS5bdKhj9GXFhLpH45ymId4lggPcnj/YWhtr3RIu9UlzQrJBYu1RuspnE2MRHFGPUvKdiaQLjXcmOqv329ijXwS/Ef3KihdfLM31iPmgw/GOot977zO5a56lESzfe1/Cs8eiV3ne6Qz7snQAIpxFh9H4vdTkPYmu5j+EVznj2FevuZKdKTt02eolIRZKeJyx8Q3tFqtOVVsr9VnmgqwpaXD+S4LC0uQ7k1F0lmVtnue6ZjWraquqZ2uVlabLZidZ9S2Cnt7CVj44HGksnkMnU/huubCds2jhqBIQDAgGBAOCAcGAYEAwgkH+Wk2C4MTH7Se1gi111Yf0XVxI/UUWJC8V8Enq2aRJsjjn2tjSd0sTfRB8J9l7X/V9H1tQFeTn+vp4v1RfZyOBjFjkMYkomj7dmK+NO7BvSOhmXN/DzBYdVw9z/Ct4qW9I0j7K3KWSU/d6RtxixCDRc6Bb9FYtJSmOd4piBd+N+C1Tl7tnnbYeNMe5TPWxaO++J3dEH2+K2/URcg97TCqKok5J8pEdixpC7tTC2N6QVm1Qgu+T5PMOwIiPHc12KwIAAAAAAAAAAHyHf+wBBDiztlt8AAAAAElFTkSuQmCC',
};

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
  const imageSource = imageName ? AllWalletAvatarImages[imageName] : undefined;
  const imageUri = imageSource
    ? accountSelectorAssetUriV2(imageSource)
    : undefined;
  if (
    accountUtils.isHwOrQrWallet({ walletId: wallet.id }) &&
    !imageUri?.trim() &&
    (imageName || !wallet.avatarInfo?.emoji)
  ) {
    return {
      kind: 'wallet',
      shape: 'rounded',
      backgroundColor: theme.strongBackground,
      image: {
        uri: colord(theme.icon ?? theme.primaryText).isLight()
          ? hardwareWalletFallbackImages.dark
          : hardwareWalletFallbackImages.light,
        width: 40,
        height: 40,
        contentFit: 'contain',
      },
      overlays,
    };
  }
  return {
    kind: 'wallet',
    shape: 'square',
    backgroundColor: '#00000000',
    image: imageName
      ? {
          uri:
            imageUri ?? accountSelectorAssetUriV2(AllWalletAvatarImages.bear),
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
