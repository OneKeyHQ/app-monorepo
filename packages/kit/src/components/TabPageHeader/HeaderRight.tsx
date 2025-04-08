import type { ReactNode } from 'react';
import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  SizableText,
  Stack,
  useIsIpadLandscape,
  useMedia,
} from '@onekeyhq/components';
import {
  HeaderButtonGroup,
  HeaderIconButton,
} from '@onekeyhq/components/src/layouts/Navigation/Header';
import {
  useDevSettingsPersistAtom,
  useNotificationsAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalNotificationsRoutes } from '@onekeyhq/shared/src/routes/notifications';
import { ETabRoutes } from '@onekeyhq/shared/src/routes/tab';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import useAppNavigation from '../../hooks/useAppNavigation';
import { UrlAccountNavHeader } from '../../views/Home/pages/urlAccount/UrlAccountNavHeader';
import { PrimeHeaderIconButtonLazy } from '../../views/Prime/components/PrimeHeaderIconButton';

import { MoreActionButton } from './MoreActionButton';

export function HeaderRight({
  sceneName,
  tabRoute,
  children,
}: {
  sceneName: EAccountSelectorSceneName;
  tabRoute: ETabRoutes;
  children?: ReactNode;
}) {
  const media = useMedia();
  const intl = useIntl();
  const navigation = useAppNavigation();
  const [{ firstTimeGuideOpened, badge }] = useNotificationsAtom();
  const [devSettings] = useDevSettingsPersistAtom();
  const isIpadLandscape = useIsIpadLandscape();

  const openNotificationsModal = useCallback(async () => {
    navigation.pushModal(EModalRoutes.NotificationsModal, {
      screen: EModalNotificationsRoutes.NotificationList,
    });
  }, [navigation]);

  const items = useMemo(() => {
    const primeButton =
      devSettings?.enabled && devSettings?.settings?.showPrimeTest ? (
        <PrimeHeaderIconButtonLazy key="prime" visible />
      ) : null;

    let notificationsButton: ReactNode | null = (
      <Stack key="notifications" testID="headerRightNotificationsButton">
        <HeaderIconButton
          title={intl.formatMessage({
            id: ETranslations.global_notifications,
          })}
          icon="BellOutline"
          onPress={openNotificationsModal}
          // TODO onLongPress also trigger onPress
          // onLongPress={showNotificationPermissionsDialog}
        />
        {!firstTimeGuideOpened || badge ? (
          <Stack
            position="absolute"
            right="$-2.5"
            top="$-2"
            alignItems="flex-end"
            w="$10"
            pointerEvents="none"
          >
            <Stack
              bg="$bgApp"
              borderRadius="$full"
              borderWidth={2}
              borderColor="$transparent"
            >
              <Stack
                px="$1"
                borderRadius="$full"
                bg="$bgCriticalStrong"
                minWidth="$4"
                height="$4"
                alignItems="center"
                justifyContent="center"
              >
                {!firstTimeGuideOpened ? (
                  <Stack
                    width="$1"
                    height="$1"
                    backgroundColor="white"
                    borderRadius="$full"
                  />
                ) : (
                  <SizableText color="$textOnColor" size="$bodySm">
                    {badge && badge > 99 ? '99+' : badge}
                  </SizableText>
                )}
              </Stack>
            </Stack>
          </Stack>
        ) : null}
      </Stack>
    );
    const moreActionButton =
      (platformEnv.isNativeIOSPad && !isIpadLandscape) ||
      tabRoute === ETabRoutes.Home ||
      platformEnv.isNativeAndroid ||
      media.gtMd ? (
        <Stack flexDirection="row" alignItems="center" gap="$4">
          {children || primeButton ? (
            <Stack
              height="$4"
              borderRightWidth={1}
              borderRightColor="$borderSubdued"
            />
          ) : null}

          <MoreActionButton key="more-action" />
        </Stack>
      ) : null;

    // const searchInput = media.gtMd ? (
    //   <UniversalSearchInput key="searchInput" />
    // ) : null;

    if (sceneName === EAccountSelectorSceneName.homeUrlAccount) {
      return [
        platformEnv.isNative ? null : (
          <UrlAccountNavHeader.OpenInApp key="urlAccountOpenInApp" />
        ),
        <UrlAccountNavHeader.Share key="urlAccountShare" />,
      ].filter(Boolean);
    }

    // notifications is not supported on web currently
    if (
      (platformEnv.isWeb && !devSettings.enabled) ||
      (tabRoute && tabRoute !== ETabRoutes.Home)
    ) {
      notificationsButton = null;
    }

    return [
      primeButton,
      notificationsButton,
      children,
      moreActionButton,
    ].filter(Boolean);
  }, [
    devSettings.enabled,
    devSettings?.settings?.showPrimeTest,
    intl,
    openNotificationsModal,
    firstTimeGuideOpened,
    badge,
    isIpadLandscape,
    sceneName,
    tabRoute,
    media.gtMd,
    children,
  ]);

  return (
    <HeaderButtonGroup
      testID="Wallet-Page-Header-Right"
      className="app-region-no-drag"
    >
      {items}
    </HeaderButtonGroup>
  );
}
