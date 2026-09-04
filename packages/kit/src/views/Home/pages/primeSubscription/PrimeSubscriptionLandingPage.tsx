import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useFocusEffect } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Button,
  Empty,
  Icon,
  Page,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { EOneKeyDeepLinkPath } from '@onekeyhq/shared/src/consts/deeplinkConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';

import { LayoutHeaderLanguageSelector } from '../../../Onboardingv2/components/Layout';
import { HomeTestIDs } from '../../testIDs';
import {
  openAppViaDeepLink,
  redirectToStore,
  scheduleDeepLinkFallbackHint,
} from '../../utils/deepLinkLaunchUtils';

const AUTO_OPEN_DELAY_MS = 300;
const PRIME_SUBSCRIPTION_DEEP_LINK_FALLBACK_DELAY_MS = 3000;

function Header() {
  return (
    <XStack h={52} px="$5" ai="center" jc="space-between">
      <Stack
        aria-label="OneKey home"
        onPress={() => {
          if (typeof globalThis.location !== 'undefined') {
            globalThis.location.href = '/';
          }
        }}
        hoverStyle={{ opacity: 0.7 }}
        pressStyle={{ opacity: 0.5 }}
      >
        <Icon name="OnekeyTextIllus" color="$text" h={28} w={102} />
      </Stack>
      <LayoutHeaderLanguageSelector />
    </XStack>
  );
}

function FallbackActions({
  onOpenApp,
  onDownload,
}: {
  onOpenApp: () => void;
  onDownload: () => void;
}) {
  const intl = useIntl();
  return (
    <YStack gap="$2.5" w="100%" maxWidth={360} mt="$5">
      <Button
        variant="accent"
        size="medium"
        icon="OpenOutline"
        onPress={onOpenApp}
        testID={HomeTestIDs.primeSubscriptionOpenAppFallbackBtn}
      >
        {intl.formatMessage({
          id: platformEnv.isWebMobile
            ? ETranslations.open_in_mobile_app
            : ETranslations.global_open_in_desktop_application,
        })}
      </Button>
      <Button
        variant="secondary"
        size="medium"
        icon="DownloadOutline"
        onPress={onDownload}
        testID={HomeTestIDs.primeSubscriptionDownloadFallbackBtn}
      >
        {intl.formatMessage({
          id: ETranslations.global_download_onekey_wallet,
        })}
      </Button>
    </YStack>
  );
}

function OpeningContent() {
  const intl = useIntl();
  return (
    <YStack w="100%" maxWidth={360} gap="$4" alignItems="center">
      <Spinner size="large" />
      <YStack gap="$2" alignItems="center" w="100%">
        <SizableText
          size="$headingXl"
          textAlign="center"
          $gtMd={{ size: '$heading2xl' }}
        >
          {intl.formatMessage({
            id: ETranslations.prime_manage_subscription,
          })}
        </SizableText>
        <SizableText size="$bodyMd" color="$textSubdued" textAlign="center">
          {intl.formatMessage({
            id: ETranslations.tray_loading_desc,
          })}
        </SizableText>
      </YStack>
    </YStack>
  );
}

function FallbackContent({
  onOpenApp,
  onDownload,
}: {
  onOpenApp: () => void;
  onDownload: () => void;
}) {
  const intl = useIntl();
  return (
    <Empty
      p="$0"
      illustration="Connection"
      title={intl.formatMessage({
        id: ETranslations.referral_web_landing_app_open_hint,
      })}
      titleProps={{
        size: '$headingXl',
        mb: '$1',
      }}
      description={intl.formatMessage({
        id: ETranslations.prime_description,
      })}
      descriptionProps={{
        size: '$bodyMd',
      }}
      button={<FallbackActions onOpenApp={onOpenApp} onDownload={onDownload} />}
    />
  );
}

function PrimeSubscriptionLandingPage() {
  const [isFallbackVisible, setIsFallbackVisible] = useState(false);
  const fallbackCleanupRef = useRef<(() => void) | null>(null);
  const lastAutoOpenedDeepLinkRef = useRef<string | null>(null);

  const deepLink = useMemo(
    () =>
      uriUtils.buildDeepLinkUrl({
        path: EOneKeyDeepLinkPath.prime_subscription,
      }),
    [],
  );

  const clearFallbackTimer = useCallback(() => {
    fallbackCleanupRef.current?.();
    fallbackCleanupRef.current = null;
  }, []);

  const handleOpenApp = useCallback(() => {
    clearFallbackTimer();
    setIsFallbackVisible(false);
    fallbackCleanupRef.current = scheduleDeepLinkFallbackHint({
      delay: PRIME_SUBSCRIPTION_DEEP_LINK_FALLBACK_DELAY_MS,
      onFallback: () => setIsFallbackVisible(true),
    });
    openAppViaDeepLink(deepLink);
  }, [clearFallbackTimer, deepLink]);

  const handleDownload = useCallback(() => {
    redirectToStore();
  }, []);

  useEffect(
    () => () => {
      clearFallbackTimer();
    },
    [clearFallbackTimer],
  );

  useEffect(() => {
    if (!platformEnv.isWeb || lastAutoOpenedDeepLinkRef.current === deepLink) {
      return undefined;
    }
    lastAutoOpenedDeepLinkRef.current = deepLink;
    const timerId = setTimeout(() => {
      handleOpenApp();
    }, AUTO_OPEN_DELAY_MS);
    return () => clearTimeout(timerId);
  }, [deepLink, handleOpenApp]);

  useFocusEffect(
    useCallback(() => {
      if (!platformEnv.isWeb) return undefined;
      appEventBus.emit(EAppEventBusNames.HideTabBar, true);
      return () => {
        appEventBus.emit(EAppEventBusNames.HideTabBar, false);
      };
    }, []),
  );

  return (
    <Page>
      <Page.Body>
        <YStack flex={1}>
          <Header />
          <YStack
            flex={1}
            w="100%"
            alignItems="center"
            justifyContent="center"
            px="$5"
            py="$10"
            $gtMd={{
              px: '$8',
              py: '$20',
            }}
          >
            {isFallbackVisible ? (
              <FallbackContent
                onOpenApp={handleOpenApp}
                onDownload={handleDownload}
              />
            ) : (
              <OpeningContent />
            )}
          </YStack>
        </YStack>
      </Page.Body>
    </Page>
  );
}

export { PrimeSubscriptionLandingPage };
