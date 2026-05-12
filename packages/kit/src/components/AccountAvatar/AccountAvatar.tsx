import type { ReactElement } from 'react';
import {
  isValidElement,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { EFirmwareType } from '@onekeyfe/hd-shared';
import { isString } from 'lodash';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import type {
  IImageFallbackProps,
  IImageLoadingProps,
  IImageProps,
  ISkeletonProps,
  SizeTokens,
} from '@onekeyhq/components';
import {
  Icon,
  Image,
  Skeleton,
  Stack,
  withStaticProperties,
} from '@onekeyhq/components';
import { startViewTransition } from '@onekeyhq/components/src/composite/Tabs/utils';
import type {
  IDBAccount,
  IDBExternalAccount,
  IDBIndexedAccount,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import { presetNetworksMap } from '@onekeyhq/shared/src/config/presetNetworks';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import externalWalletLogoUtils from '@onekeyhq/shared/src/utils/externalWalletLogoUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';

import { NetworkAvatar } from '../NetworkAvatar';
import { WalletAvatar } from '../WalletAvatar';

import { useBlockieImageUri } from './makeBlockieImageUriList';

import type { ImageStyle } from 'react-native';

// Module-level cache to track shown avatar sources (persists across component instances)
const shownAvatarSourcesCache = new Set<string>();
const SHOWN_AVATAR_SOURCES_CACHE_LIMIT = 500;

const VARIANT_SIZE = {
  'default': {
    containerSize: '$10',
    logoContainerSize: '$5',
    logoSize: '$4',
    relativeMargin: '$6',
  },
  'medium': {
    containerSize: '$8',
    logoContainerSize: '$5',
    logoSize: '$4',
    relativeMargin: '$4',
  },
  'small': {
    containerSize: '$6',
    logoContainerSize: '$4',
    logoSize: '$3',
    relativeMargin: '$3',
  },
};

type IKeyOfVariantSize = keyof typeof VARIANT_SIZE;

export interface IAccountAvatarProps extends IImageProps {
  address?: string;
  size?: IKeyOfVariantSize | SizeTokens;
  networkId?: string;
  account?: INetworkAccount;
  dbAccount?: IDBAccount;
  indexedAccount?: IDBIndexedAccount;
  loading?: ReactElement;
  loadingProps?: IImageLoadingProps;
  fallback?: ReactElement;
  fallbackProps?: IImageFallbackProps;
  wallet?: IDBWallet;
}

const getBlockieImageId = (id?: string) => {
  if (!id) {
    return '';
  }
  return id.replaceAll(':', '');
};

function DefaultImageLoading({
  delayMs = 150,
  ...props
}: { delayMs?: number } & ISkeletonProps) {
  return (
    <Image.Loading delayMs={delayMs}>
      <Skeleton {...props} />
    </Image.Loading>
  );
}

function DefaultImageFallback() {
  return (
    <Image.Fallback
      flex={1}
      bg="$bgStrong"
      alignItems="center"
      justifyContent="center"
    >
      <Icon name="AccountErrorCustom" size="$4.5" color="$textSubdued" />
    </Image.Fallback>
  );
}

function DefaultEmptyAccount() {
  return (
    <Stack flex={1} bg="$bgStrong" alignItems="center" justifyContent="center">
      <Icon name="CrossedSmallSolid" size="$6" />
    </Stack>
  );
}

function BasicAccountAvatar({
  size = 'default',
  src,
  address,
  source,
  account,
  indexedAccount,
  dbAccount,
  loading,
  loadingProps,
  fallback,
  fallbackProps,
  networkId,
  wallet,
  ...restProps
}: IAccountAvatarProps) {
  const isValidSize = !!VARIANT_SIZE[size as IKeyOfVariantSize];
  const { containerSize, logoContainerSize, logoSize, relativeMargin } =
    isValidSize
      ? VARIANT_SIZE[size as IKeyOfVariantSize]
      : {
          ...VARIANT_SIZE.default,
          containerSize: size || VARIANT_SIZE.default.containerSize,
        };

  const accountSourceUri = useBlockieImageUri(
    getBlockieImageId(
      address ||
        indexedAccount?.idHash ||
        indexedAccount?.id ||
        (account || dbAccount)?.address,
    ),
  );

  const firmwareType = useMemo(() => {
    return wallet?.firmwareTypeAtCreated;
  }, [wallet?.firmwareTypeAtCreated]);

  const uriSource = useMemo(() => {
    const emptyAccountAvatar = <DefaultEmptyAccount />;

    if (address || indexedAccount) {
      return {
        uri: accountSourceUri,
      };
    }
    // dbAccount exists, but network not compatible, so account is undefined
    const finalAccount = account || dbAccount;
    if (finalAccount) {
      if (accountUtils.isExternalAccount({ accountId: finalAccount.id })) {
        const renderExternalAvatar = (logo: string) => {
          if (!logo) {
            return null;
          }
          if (isString(logo)) {
            return { uri: logo };
          }
          return logo;
        };
        const externalAccount = finalAccount as IDBExternalAccount;

        const wcPeerMeta =
          externalAccount?.connectionInfo?.walletConnect?.peerMeta;
        if (wcPeerMeta) {
          const { logo } = externalWalletLogoUtils.getLogoInfoFromWalletConnect(
            {
              peerMeta: wcPeerMeta,
            },
          );
          if (logo) {
            return renderExternalAvatar(logo);
          }
        }

        // TODO move account avatar icon calculation to getAccount() in background
        const externalWalletIcon =
          externalAccount?.connectionInfo?.evmEIP6963?.info?.icon ||
          externalAccount?.connectionInfo?.evmInjected?.icon ||
          externalAccount?.connectionInfo?.walletConnect?.peerMeta?.icons?.[0];
        if (externalWalletIcon) {
          return renderExternalAvatar(externalWalletIcon);
        }

        // some dapps don't provide icons, fallback to walletconnect icon
        // TODO use wcPeerMeta.name or wcPeerMeta.url to find wallet icon
        if (wcPeerMeta || externalAccount?.connectionInfo?.walletConnect) {
          const walletConnectIcon =
            externalWalletLogoUtils.getLogoInfo('walletconnect').logo;
          return renderExternalAvatar(walletConnectIcon);
        }
      }
      return finalAccount.address
        ? {
            uri: accountSourceUri,
          }
        : emptyAccountAvatar;
    }
    if (source || src || fallbackProps) {
      return src ? { uri: src } : source;
    }

    return emptyAccountAvatar;
  }, [
    account,
    accountSourceUri,
    address,
    dbAccount,
    fallbackProps,
    indexedAccount,
    source,
    src,
  ]);

  const renderLoading = useMemo(
    () =>
      loading ??
      (loadingProps ? (
        <Image.Loading {...loadingProps} />
      ) : (
        <DefaultImageLoading w={containerSize} h={containerSize} />
      )),
    [containerSize, loading, loadingProps],
  );

  const renderFallback = useMemo(() => {
    // error of externalAccount
    const finalAccount = account || dbAccount;
    if (
      finalAccount &&
      accountUtils.isExternalAccount({ accountId: finalAccount.id })
    ) {
      const externalAccount = finalAccount as IDBExternalAccount;

      if (externalAccount) {
        return <DefaultImageFallback />;
      }
    }
    if (
      address ||
      indexedAccount ||
      account ||
      source ||
      src ||
      loadingProps ||
      loading ||
      fallback ||
      fallbackProps
    ) {
      return (
        fallback ||
        (fallbackProps ? <Image.Fallback {...fallbackProps} /> : null)
      );
    }

    return null;
  }, [
    account,
    address,
    dbAccount,
    fallback,
    fallbackProps,
    indexedAccount,
    loading,
    loadingProps,
    source,
    src,
  ]);

  // Generate a stable key for animation based on source
  const getSourceKey = useCallback((imgSource: typeof uriSource) => {
    if (isValidElement(imgSource)) {
      return 'element';
    }
    const imgSrc = imgSource as IImageProps['source'];
    if (imgSrc && typeof imgSrc === 'object' && 'uri' in imgSrc) {
      return imgSrc.uri ?? '';
    }
    return String(imgSrc);
  }, []);

  const sourceKey = useMemo(
    () => getSourceKey(uriSource),
    [getSourceKey, uriSource],
  );

  // Track displayed source for view transition animation
  const [displayedSource, setDisplayedSource] = useState(uriSource);
  const [displayedKey, setDisplayedKey] = useState(sourceKey);
  const prevSourceKeyRef = useRef(sourceKey);

  // Stable cache key based on address (not URI which may vary)
  const stableAddressKey =
    address ||
    indexedAccount?.idHash ||
    indexedAccount?.id ||
    (account || dbAccount)?.address ||
    '';

  // Decide animation ONCE at mount, based on address (not URI)
  // Using lazy initialization to ensure decision is made only once per instance
  const shouldAnimateRef = useRef<boolean | undefined>(undefined);
  if (shouldAnimateRef.current === undefined && stableAddressKey) {
    const isFirstGlobalAppearance =
      !shownAvatarSourcesCache.has(stableAddressKey);
    shouldAnimateRef.current = isFirstGlobalAppearance;
    if (isFirstGlobalAppearance) {
      if (shownAvatarSourcesCache.size >= SHOWN_AVATAR_SOURCES_CACHE_LIMIT) {
        shownAvatarSourcesCache.clear();
      }
      shownAvatarSourcesCache.add(stableAddressKey);
    }
  }

  // Use startViewTransition when source changes
  useLayoutEffect(() => {
    if (sourceKey !== prevSourceKeyRef.current) {
      prevSourceKeyRef.current = sourceKey;
      startViewTransition(() => {
        setDisplayedSource(uriSource);
        setDisplayedKey(sourceKey);
      });
    }
  }, [sourceKey, uriSource]);

  // Animation controlled by shared value for precise timing
  const opacity = useSharedValue(shouldAnimateRef.current === true ? 0 : 1);
  const hasTriggeredAnimationRef = useRef(false);

  // Trigger fade-in animation when displayedKey becomes non-empty for the first time
  useLayoutEffect(() => {
    if (
      displayedKey &&
      shouldAnimateRef.current === true &&
      !hasTriggeredAnimationRef.current
    ) {
      hasTriggeredAnimationRef.current = true;
      shouldAnimateRef.current = false;
      opacity.value = withTiming(1, { duration: 200 });
    }
  }, [displayedKey, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Stack
      w={containerSize}
      h={containerSize}
      justifyContent="center"
      alignItems="center"
    >
      {isValidElement(displayedSource) ? (
        displayedSource
      ) : (
        <Animated.View
          style={[{ width: '100%', height: '100%' }, animatedStyle]}
        >
          <Image
            size={containerSize}
            source={displayedSource as IImageProps['source']}
            style={
              {
                borderCurve: 'continuous',
              } as ImageStyle
            }
            bg="$bgStrong"
            borderRadius={size === 'small' ? '$1' : '$2'}
            {...restProps}
            skeleton={renderLoading}
            fallback={renderFallback}
          />
        </Animated.View>
      )}

      {wallet ? (
        <Stack
          position="absolute"
          justifyContent="center"
          alignItems="center"
          height="$5"
          width="$5"
          bottom="$-1.5"
          right="$-1.5"
          zIndex="$1"
        >
          <Stack
            position="absolute"
            top="$0"
            bottom="$0"
            borderCurve="continuous"
            bg="$bgApp"
            {...(wallet.type === 'hw' &&
            !accountUtils.isHwHiddenWallet({ wallet })
              ? { right: '$0.5', left: '$0.5', borderRadius: 2 }
              : { right: '$0', left: '$0', borderRadius: '$1' })}
          />
          <WalletAvatar wallet={wallet} size="$5" />
        </Stack>
      ) : null}
      {networkId ? (
        <Stack
          position="absolute"
          justifyContent="center"
          alignItems="center"
          height={logoContainerSize}
          width={logoContainerSize}
          top={relativeMargin}
          left={relativeMargin}
          bg="$bgApp"
          p="$px"
          borderRadius="$full"
          zIndex="$1"
        >
          <NetworkAvatar networkId={networkId} size={logoSize} />
        </Stack>
      ) : null}

      {firmwareType === EFirmwareType.BitcoinOnly ? (
        <Stack
          position="absolute"
          h="$4"
          px="$0.5"
          justifyContent="center"
          top={-4}
          left={-4}
          borderRadius="$full"
          zIndex="$1"
        >
          <NetworkAvatar networkId={presetNetworksMap.btc.id} size={14} />
        </Stack>
      ) : null}
    </Stack>
  );
}

export const AccountAvatar = withStaticProperties(BasicAccountAvatar, {
  Loading: DefaultImageLoading,
});
