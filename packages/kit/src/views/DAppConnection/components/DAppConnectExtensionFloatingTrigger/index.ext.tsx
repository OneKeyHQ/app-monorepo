import { useCallback, useEffect } from 'react';

import { Icon, Image, Skeleton, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EDAppConnectionModal,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';
import type { IConnectionAccountInfoWithNum } from '@onekeyhq/shared/types/dappConnection';

export default function DAppConnectExtensionFloatingTrigger() {
  const { result, run } = usePromiseResult(
    () =>
      new Promise<{
        url: string;
        origin: string;
        showFloatingButton: boolean;
        connectedAccountsInfo: IConnectionAccountInfoWithNum[] | null;
        faviconUrl: string | undefined;
        originFaviconUrl: string | undefined;
      } | null>((resolve) => {
        chrome.tabs.query(
          { active: true, currentWindow: true },
          async (tabs) => {
            if (tabs[0]) {
              try {
                const currentOrigin = new URL(tabs[0]?.url ?? '').origin;
                const connectedAccountsInfo =
                  await backgroundApiProxy.serviceDApp.findInjectedAccountByOrigin(
                    currentOrigin,
                  );
                const faviconUrl =
                  await backgroundApiProxy.serviceDiscovery.buildWebsiteIconUrl(
                    currentOrigin,
                    40,
                  );
                resolve({
                  url: tabs[0].url ?? '',
                  origin: currentOrigin,
                  showFloatingButton: (connectedAccountsInfo ?? []).length > 0,
                  connectedAccountsInfo,
                  faviconUrl,
                  originFaviconUrl: tabs[0].favIconUrl,
                });
                return;
              } catch (error) {
                console.error('DappConnectExtensionPanel error:', error);
                resolve(null);
                return;
              }
            }
            resolve(null);
          },
        );
      }),
    [],
    {
      checkIsFocused: false,
    },
  );

  useEffect(() => {
    appEventBus.on(EAppEventBusNames.DAppConnectUpdate, run);
    return () => {
      appEventBus.off(EAppEventBusNames.DAppConnectUpdate, run);
    };
  }, [run]);

  const navigation = useAppNavigation();
  const handlePressFloatingButton = useCallback(() => {
    navigation.pushModal(EModalRoutes.DAppConnectionModal, {
      screen: EDAppConnectionModal.CurrentConnectionModal,
      params: {
        origin: result?.origin ?? '',
        faviconUrl: result?.faviconUrl ?? '',
      },
    });
  }, [result, navigation]);

  if (!result?.showFloatingButton) {
    return null;
  }

  return (
    <Stack
      position="absolute"
      bottom="$2"
      right="$2"
      h="$14"
      w="$14"
      space="$2"
      alignItems="center"
      justifyContent="center"
      bg="$bgApp"
      borderRadius="$3"
      shadowOffset={{
        width: 0,
        height: 12,
      }}
      shadowRadius={24}
      shadowColor="rgba(0, 0, 0, 0.09)"
      borderColor="$border"
      borderWidth="$px"
      onPress={handlePressFloatingButton}
    >
      <Stack position="relative">
        <Image size="$10" borderRadius="$2">
          <Image.Source src={result?.faviconUrl || result?.originFaviconUrl} />
          <Image.Fallback>
            <Icon size="$10" name="GlobusOutline" />
          </Image.Fallback>
          <Image.Loading>
            <Skeleton width="100%" height="100%" />
          </Image.Loading>
        </Image>
        <Stack
          position="absolute"
          bottom={-2}
          right={-2}
          justifyContent="center"
          alignItems="center"
          w="$3"
          h="$3"
          borderRadius="$full"
          bg="$bg"
          zIndex="$1"
        >
          <Stack w="$2" h="$2" bg="$iconSuccess" borderRadius="$full" />
        </Stack>
      </Stack>
    </Stack>
  );
}
