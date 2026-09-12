import { useCallback } from 'react';

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
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { LayoutHeaderLanguageSelector } from '../../Onboardingv2/components/Layout';
import { redirectToStore } from '../utils/deepLinkLaunchUtils';

export type IDeepLinkLandingProps = {
  loadingTitle: string;
  fallbackDescription: string;
  isFallbackVisible: boolean;
  onOpenApp: () => void;
  openAppTestID: string;
  downloadTestID: string;
};

export function DeepLinkLanding({
  loadingTitle,
  fallbackDescription,
  isFallbackVisible,
  onOpenApp,
  openAppTestID,
  downloadTestID,
}: IDeepLinkLandingProps) {
  const intl = useIntl();

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
                description={fallbackDescription}
                descriptionProps={{
                  size: '$bodyMd',
                }}
                button={
                  <YStack gap="$2.5" w="100%" maxWidth={360} mt="$5">
                    <Button
                      variant="accent"
                      size="medium"
                      icon="OpenOutline"
                      onPress={onOpenApp}
                      testID={openAppTestID}
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
                      onPress={redirectToStore}
                      testID={downloadTestID}
                    >
                      {intl.formatMessage({
                        id: ETranslations.global_download_onekey_wallet,
                      })}
                    </Button>
                  </YStack>
                }
              />
            ) : (
              <YStack w="100%" maxWidth={360} gap="$4" alignItems="center">
                <Spinner size="large" />
                <YStack gap="$2" alignItems="center" w="100%">
                  <SizableText
                    size="$headingXl"
                    textAlign="center"
                    $gtMd={{ size: '$heading2xl' }}
                  >
                    {loadingTitle}
                  </SizableText>
                  <SizableText
                    size="$bodyMd"
                    color="$textSubdued"
                    textAlign="center"
                  >
                    {intl.formatMessage({
                      id: ETranslations.tray_loading_desc,
                    })}
                  </SizableText>
                </YStack>
              </YStack>
            )}
          </YStack>
        </YStack>
      </Page.Body>
    </Page>
  );
}
