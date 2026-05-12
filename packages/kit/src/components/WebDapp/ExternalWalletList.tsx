import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';
import semver from 'semver';

import {
  Badge,
  Button,
  Dialog,
  Divider,
  Icon,
  Image,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';
import {
  EKeylessWebPrivateRpcMethod,
  type IKeylessWebOpenSidePanelPayload,
  KEYLESS_WEB_LEGACY_EXTENSION_VERSION_MAX,
  KEYLESS_WEB_OPEN_SIDE_PANEL_EVENT,
} from '@onekeyhq/shared/src/keylessWallet/keylessWebTypes';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { getOneKeyExtensionStoreUrl } from '@onekeyhq/shared/src/utils/extensionStoreUtils';
import externalWalletLogoUtils from '@onekeyhq/shared/src/utils/externalWalletLogoUtils';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { IExternalConnectionInfo } from '@onekeyhq/shared/types/externalWallet.types';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../hooks/usePromiseResult';
import keylessWebPendingLoginCache from '../../hooks/useWebDapp/keylessWebPendingLoginCache';
import { useConnectExternalWallet } from '../../hooks/useWebDapp/useConnectExternalWallet';
import { useKeylessWebFlow } from '../../hooks/useWebDapp/useKeylessWebFlow';
import { useOneKeyWalletDetection } from '../../hooks/useWebDapp/useOneKeyWalletDetection';
import { useWalletConnection } from '../../hooks/useWebDapp/useWalletConnection';
import { FormatHyperlinkText } from '../HyperlinkText';

import { useFallbackWallets } from './hooks/useFallbackWallets';

const walletConnectInfo = externalWalletLogoUtils.getLogoInfo('walletconnect');
const KEYLESS_STORE_URL_TARGET = 'onekey-extension-install-store-target';
const KEYLESS_PROVIDER_LOADING_DURATION_MS = 2000;
let keylessStoreWindowRef: Window | null = null;

const KEYLESS_SOCIAL_PROVIDERS = [
  {
    provider: EOAuthSocialLoginProvider.Google,
    iconName: 'GoogleIllus',
    platformLabel: 'Google',
  },
  {
    provider: EOAuthSocialLoginProvider.Apple,
    iconName: 'AppleBrand',
    platformLabel: 'Apple',
  },
] as const;

type IOneKeyPrivateProvider = {
  request?: <T = unknown>(args: {
    method: string;
    params?: Record<string, unknown>;
  }) => Promise<T>;
};

type IOneKeyEthereumProvider = {
  request?: <T = unknown>(args: {
    method: string;
    params?: readonly unknown[] | Record<string, unknown>;
  }) => Promise<T>;
};

type IOneKeyInjectedProvider = {
  ethereum?: IOneKeyEthereumProvider;
  $private?: IOneKeyPrivateProvider;
};

function getOneKeyInjectedProvider() {
  return (globalThis as { $onekey?: IOneKeyInjectedProvider }).$onekey;
}

function getOneKeyEthereumProvider() {
  return getOneKeyInjectedProvider()?.ethereum;
}

function getOneKeyPrivateProvider() {
  return getOneKeyInjectedProvider()?.$private;
}

async function hasAuthorizedOneKeyAccounts() {
  const accounts = await getOneKeyEthereumProvider()
    ?.request?.<readonly string[]>({
      method: 'eth_accounts',
    })
    .catch(() => undefined);

  return Boolean(accounts?.length);
}

function notifyOpenKeylessSidePanelInContentScript(
  payload: IKeylessWebOpenSidePanelPayload,
) {
  try {
    const event = new CustomEvent(KEYLESS_WEB_OPEN_SIDE_PANEL_EVENT, {
      detail: payload,
    });
    globalThis.dispatchEvent(event);
  } catch (error) {
    console.error('notifyOpenKeylessSidePanelInContentScript', error);
  }
}

function WalletItemView({
  onPress,
  logo,
  name,
  loading,
  networkType,
}: {
  onPress: () => void;
  logo: any;
  name: string;
  loading?: boolean;
  networkType?: string;
}) {
  return (
    <Stack flexBasis="50%" p="$1.5">
      <Stack
        borderRadius="$3"
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
        py="$3"
        pl="$3"
        pr="$5"
        cursor="pointer"
        hoverStyle={{
          bg: '$bgStrong',
        }}
        pressStyle={{
          bg: '$bgActive',
        }}
        onPress={onPress}
        focusable
        focusVisibleStyle={{
          outlineColor: '$focusRing',
          outlineStyle: 'solid',
          outlineWidth: 2,
          outlineOffset: 2,
        }}
        minHeight={70}
      >
        <XStack alignItems="center" gap="$3" flex={1}>
          <Stack
            w="$10"
            h="$10"
            alignItems="center"
            justifyContent="center"
            borderRadius="$2"
            borderCurve="continuous"
            overflow="hidden"
          >
            {!loading ? (
              <Image w="100%" h="100%" source={logo} />
            ) : (
              <Spinner size="small" />
            )}
          </Stack>
          <Stack flex={1} justifyContent="center">
            <SizableText userSelect="none" size="$bodyLgMedium">
              {name}
            </SizableText>
            {networkType ? (
              <SizableText size="$bodyMd" color="$textSubdued">
                {networkType}
              </SizableText>
            ) : null}
          </Stack>
        </XStack>
      </Stack>
    </Stack>
  );
}

function WalletItem({
  logo,
  name,
  connectionInfo,
  networkType,
}: {
  name?: string;
  logo: any;
  connectionInfo: IExternalConnectionInfo;
  networkType?: string;
}) {
  const { loading, connectToWalletWithDialogShow } = useWalletConnection({
    name,
    connectionInfo,
  });

  return (
    <WalletItemView
      onPress={connectToWalletWithDialogShow}
      logo={logo}
      name={name || 'unknown'}
      loading={loading}
      networkType={networkType}
    />
  );
}

function OneKeyWalletItem({
  networkType,
  isOneKeyConnected,
}: {
  networkType?: string;
  isOneKeyConnected: boolean;
}) {
  const intl = useIntl();
  const { isOneKeyInstalled, getOneKeyConnectionInfo } =
    useOneKeyWalletDetection();
  const { connectToWalletWithDialog } = useConnectExternalWallet();

  const handlePress = useCallback(() => {
    if (isOneKeyInstalled) {
      const connectionInfo = getOneKeyConnectionInfo();
      if (connectionInfo) {
        void connectToWalletWithDialog(connectionInfo);
      }
    } else {
      openUrlExternal(getOneKeyExtensionStoreUrl());
    }
  }, [isOneKeyInstalled, getOneKeyConnectionInfo, connectToWalletWithDialog]);

  return (
    <Stack flexBasis="50%" p="$1.5">
      <Stack
        borderRadius="$3"
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
        py="$3"
        pl="$3"
        pr="$5"
        cursor={isOneKeyConnected ? 'default' : 'pointer'}
        opacity={isOneKeyConnected ? 0.6 : 1}
        hoverStyle={isOneKeyConnected ? undefined : { bg: '$bgStrong' }}
        pressStyle={isOneKeyConnected ? undefined : { bg: '$bgActive' }}
        onPress={isOneKeyConnected ? undefined : handlePress}
        focusable={!isOneKeyConnected}
        focusVisibleStyle={{
          outlineColor: '$focusRing',
          outlineStyle: 'solid',
          outlineWidth: 2,
          outlineOffset: 2,
        }}
        minHeight={70}
      >
        <XStack alignItems="center" gap="$3" flex={1}>
          <Stack
            w="$10"
            h="$10"
            alignItems="center"
            justifyContent="center"
            borderRadius="$2"
            borderCurve="continuous"
            overflow="hidden"
          >
            <Icon
              name="OnekeyBrand"
              size="$10"
              bg="#44D62C"
              borderRadius="$2"
            />
          </Stack>
          <Stack flex={1} justifyContent="center">
            <XStack alignItems="center" gap="$2">
              <SizableText userSelect="none" size="$bodyLgMedium">
                OneKey
              </SizableText>
              <Badge badgeType="success" badgeSize="sm">
                {intl.formatMessage({
                  id: isOneKeyConnected
                    ? ETranslations.global_connected
                    : ETranslations.earn_recommended,
                })}
              </Badge>
            </XStack>
            <SizableText size="$bodyMd" color="$textSubdued">
              {isOneKeyInstalled
                ? networkType
                : intl.formatMessage({
                    id: ETranslations.wallet_onekey_wallet_without_description,
                  })}
            </SizableText>
          </Stack>
        </XStack>
      </Stack>
    </Stack>
  );
}

function KeylessProviderButtons({
  keylessWalletExists,
}: {
  keylessWalletExists: boolean;
}) {
  const intl = useIntl();
  const { isOneKeyInstalled, getOneKeyConnectionInfo } =
    useOneKeyWalletDetection();
  const { connectToWalletForKeylessSilently } = useConnectExternalWallet();
  const [loadingProvider, setLoadingProvider] =
    useState<EOAuthSocialLoginProvider | null>(null);
  const loadingProviderRef = useRef<EOAuthSocialLoginProvider | null>(null);
  const loadingTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const { startKeylessWebFlow } = useKeylessWebFlow();
  const { result: isLegacyExtension } = usePromiseResult(
    async () => {
      if (!platformEnv.isWebDappMode || !isOneKeyInstalled) {
        return false;
      }
      const response = await getOneKeyPrivateProvider()
        ?.request?.<{ walletInfo?: { version?: string } }>({
          method: 'wallet_getConnectWalletInfo',
        })
        .catch(() => undefined);
      const version = response?.walletInfo?.version;
      if (!version) {
        return false;
      }
      try {
        return semver.lte(version, KEYLESS_WEB_LEGACY_EXTENSION_VERSION_MAX);
      } catch {
        return false;
      }
    },
    [isOneKeyInstalled],
    { initResult: false },
  );

  const clearProviderLoading = useCallback(
    (provider?: EOAuthSocialLoginProvider) => {
      if (provider && loadingProviderRef.current !== provider) {
        return;
      }
      loadingProviderRef.current = null;
      setLoadingProvider(null);
    },
    [],
  );

  const startProviderLoading = useCallback(
    (provider: EOAuthSocialLoginProvider) => {
      if (loadingProviderRef.current) {
        return false;
      }
      loadingProviderRef.current = provider;
      setLoadingProvider(provider);
      clearTimeout(loadingTimerRef.current);
      loadingTimerRef.current = setTimeout(() => {
        clearProviderLoading(provider);
      }, KEYLESS_PROVIDER_LOADING_DURATION_MS);
      return true;
    },
    [clearProviderLoading],
  );

  useEffect(
    () => () => {
      clearTimeout(loadingTimerRef.current);
      loadingProviderRef.current = null;
    },
    [],
  );

  const showInstallOneKeyDialog = useCallback(
    (provider: EOAuthSocialLoginProvider) => {
      Dialog.show({
        title: intl.formatMessage({
          id: ETranslations.install_extension_first,
        }),
        description: (
          <FormatHyperlinkText
            size="$bodyMd"
            color="$textSubdued"
            textAlign="center"
            actionTextProps={{
              color: '$textInfo',
            }}
            underlineTextProps={{
              color: '$textInfo',
            }}
            onAction={() => {
              globalThis.location.reload();
            }}
          >
            {intl.formatMessage({
              id: ETranslations.install_extension_first_desc,
            })}
          </FormatHyperlinkText>
        ),
        onConfirmText: intl.formatMessage({
          id: ETranslations.global_install,
        }),
        onConfirm: async () => {
          await startKeylessWebFlow(provider);
          const storeUrl = getOneKeyExtensionStoreUrl();
          if (keylessStoreWindowRef && !keylessStoreWindowRef.closed) {
            try {
              keylessStoreWindowRef.location.href = storeUrl;
              keylessStoreWindowRef.focus();
              return;
            } catch {
              keylessStoreWindowRef = null;
            }
          }
          keylessStoreWindowRef = window.open(
            storeUrl,
            KEYLESS_STORE_URL_TARGET,
          );
        },
        onCancelText: intl.formatMessage({
          id: ETranslations.global_cancel,
        }),
      });
    },
    [intl, startKeylessWebFlow],
  );

  const handleKeylessProviderPress = useCallback(
    async (provider: EOAuthSocialLoginProvider) => {
      if (!startProviderLoading(provider)) {
        return;
      }

      if (!isOneKeyInstalled) {
        showInstallOneKeyDialog(provider);
      } else {
        const oneKeyPrivateProvider = getOneKeyPrivateProvider();
        const keylessStatus = await oneKeyPrivateProvider
          ?.request?.<{
            walletExists?: boolean;
            walletType?: EOAuthSocialLoginProvider;
          }>({
            method: EKeylessWebPrivateRpcMethod.GetStatus,
            params: { provider },
          })
          .catch(() => undefined);

        if (keylessStatus) {
          const shouldOpenSidePanel = !keylessStatus.walletExists;
          if (shouldOpenSidePanel) {
            // Only write pending hash params when we actually need the
            // side-panel onboarding flow; avoids leaving stale nonces that
            // scanWebLoginTabs() would later treat as a new pending login.
            await startKeylessWebFlow(provider);
            const pendingLogin =
              keylessWebPendingLoginCache.readKeylessPendingLogin();
            notifyOpenKeylessSidePanelInContentScript({
              provider,
              nonce: pendingLogin?.nonce,
            });
            return;
          }
        }

        // Wallet already exists — connect silently without writing hash params.
        const connectionInfo = getOneKeyConnectionInfo();
        if (connectionInfo) {
          const hasAuthorizedAccounts = await hasAuthorizedOneKeyAccounts();
          await connectToWalletForKeylessSilently(
            connectionInfo,
            hasAuthorizedAccounts && keylessStatus?.walletExists
              ? undefined
              : { provider },
          );
        } else {
          showInstallOneKeyDialog(provider);
        }
      }
    },
    [
      connectToWalletForKeylessSilently,
      getOneKeyConnectionInfo,
      isOneKeyInstalled,
      showInstallOneKeyDialog,
      startKeylessWebFlow,
      startProviderLoading,
    ],
  );

  if (!platformEnv.isWebDappMode) {
    return null;
  }

  if (isLegacyExtension) {
    return null;
  }

  if (keylessWalletExists) {
    return null;
  }

  return (
    <YStack gap="$2">
      <XStack gap="$2">
        {KEYLESS_SOCIAL_PROVIDERS.map(
          ({ provider, iconName, platformLabel }) => (
            <Button
              key={provider}
              testID={`web-dapp-keyless-${provider}-btn`}
              flex={1}
              bg="$gray3"
              hoverStyle={{ bg: '$gray4' }}
              pressStyle={{ bg: '$gray5' }}
              size="large"
              childrenAsText={false}
              cursor={loadingProvider ? 'not-allowed' : 'pointer'}
              disabled={!!loadingProvider}
              onPress={
                loadingProvider
                  ? undefined
                  : () => {
                      void handleKeylessProviderPress(provider);
                    }
              }
            >
              <XStack gap="$2" alignItems="center">
                <Stack
                  w="$5"
                  h="$5"
                  alignItems="center"
                  justifyContent="center"
                >
                  {loadingProvider === provider ? (
                    <Spinner size="small" />
                  ) : (
                    <Icon name={iconName} size="$5" />
                  )}
                </Stack>
                <SizableText size="$bodyLgMedium">
                  {intl.formatMessage(
                    {
                      id: ETranslations.continue_with_social_platform,
                    },
                    { platform: platformLabel },
                  )}
                </SizableText>
              </XStack>
            </Button>
          ),
        )}
      </XStack>
      <XStack gap="$2" py="$4" alignItems="center" w="100%">
        <Divider flex={1} borderColor="$borderDisabled" />
        <SizableText
          size="$bodySmMedium"
          color="$textDisabled"
          userSelect="none"
        >
          {intl.formatMessage({
            id: ETranslations.global_or,
          })}
        </SizableText>
        <Divider flex={1} borderColor="$borderDisabled" />
      </XStack>
    </YStack>
  );
}

function WalletConnectItem({ impl }: { impl?: string }) {
  return (
    <WalletItem
      name={walletConnectInfo.name}
      logo={walletConnectInfo.logo}
      connectionInfo={{
        walletConnect: {
          impl,
          isNewConnection: true,
          topic: '',
          peerMeta: {
            name: '',
            icons: [],
            description: '',
            url: '',
          },
        },
      }}
    />
  );
}

function ExternalWalletList({ impl }: { impl?: string }) {
  const { isOneKeyInstalled } = useOneKeyWalletDetection();

  const {
    result: { walletExists: keylessWalletExists, siteConnected },
  } = usePromiseResult(
    async () => {
      if (!platformEnv.isWebDappMode || !isOneKeyInstalled) {
        return { walletExists: false, siteConnected: false };
      }
      const status = await getOneKeyPrivateProvider()
        ?.request?.<{ walletExists?: boolean; siteConnected?: boolean }>({
          method: EKeylessWebPrivateRpcMethod.GetStatus,
        })
        .catch(() => undefined);
      return {
        walletExists: Boolean(status?.walletExists),
        siteConnected: Boolean(status?.siteConnected),
      };
    },
    [isOneKeyInstalled],
    { initResult: { walletExists: false, siteConnected: false } },
  );
  const isOneKeyConnected = keylessWalletExists && siteConnected;

  // detect available wallets
  const { result: allWallets = { wallets: {} } } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceDappSide.listAllWallets({
        impls: impl ? [impl] : [],
      }),
    [impl],
  );

  const detectedWallets =
    allWallets?.wallets?.[impl || '--']?.filter?.((item) => {
      // filter out injected wallets
      if (item.connectionInfo?.evmInjected) {
        return false;
      }
      // filter out OneKey wallets (already shown in the first tab)
      if (item.name?.toLowerCase().includes('onekey')) {
        return false;
      }
      return true;
    }) ?? [];

  const networkLabel = impl === 'sol' ? 'SOL' : 'EVM';

  const detectedFallbackKeys = new Set<string>();
  const fallbackWallets = useFallbackWallets();

  const walletItems = detectedWallets.map((item, index) => {
    const { name, icon, connectionInfo } = item;
    const loweredName = name?.toLowerCase() || '';

    fallbackWallets.forEach(({ key, detectKeywords }) => {
      if (detectKeywords.some((keyword) => loweredName.includes(keyword))) {
        detectedFallbackKeys.add(key);
      }
    });

    return (
      <WalletItem
        key={`wallet-${index}`}
        logo={icon}
        name={name || 'unknown'}
        connectionInfo={connectionInfo}
        networkType={networkLabel}
      />
    );
  });

  const fallbackWalletItems = fallbackWallets
    .filter(({ key }) => !detectedFallbackKeys.has(key))
    .map(({ key, storeUrl, logo, name, networkType }) => (
      <WalletItemView
        key={`wallet-${key}-store`}
        onPress={() => {
          void openUrlExternal(storeUrl);
        }}
        logo={logo}
        name={name}
        networkType={networkType}
      />
    ));

  return (
    <Stack px="$5" pt="$2" pb="$4">
      <KeylessProviderButtons keylessWalletExists={keylessWalletExists} />
      <XStack flexWrap="wrap" mx="$-1.5">
        <OneKeyWalletItem
          networkType={networkLabel}
          isOneKeyConnected={isOneKeyConnected}
        />
        {walletItems}
        {fallbackWalletItems}
        <WalletConnectItem impl={impl} />
      </XStack>
    </Stack>
  );
}

// WalletConnect ListItem component for use in OneKeyWalletConnectionOptions
function WalletConnectListItemComponent({
  impl,
  ...listItemProps
}: {
  impl?: string;
} & React.ComponentProps<typeof ListItem>) {
  const connectionInfo: IExternalConnectionInfo = {
    walletConnect: {
      impl,
      isNewConnection: true,
      topic: '',
      peerMeta: {
        name: '',
        icons: [],
        description: '',
        url: '',
      },
    },
  };

  const { loading, connectToWalletWithDialogShow } = useWalletConnection({
    name: walletConnectInfo.name,
    connectionInfo,
  });

  return (
    <ListItem
      {...listItemProps}
      title={walletConnectInfo.name}
      renderAvatar={
        <Image
          w="$10"
          h="$10"
          source={walletConnectInfo.logo}
          borderRadius="$3"
        />
      }
      drillIn={!loading}
      onPress={connectToWalletWithDialogShow}
      isLoading={loading}
    />
  );
}

export {
  ExternalWalletList,
  WalletConnectItem,
  WalletConnectListItemComponent,
};
