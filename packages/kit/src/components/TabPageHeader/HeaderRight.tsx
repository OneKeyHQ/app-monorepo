import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { ActionList, SizableText, Stack, useMedia } from '@onekeyhq/components';
import {
  HeaderButtonGroup,
  HeaderIconButton,
} from '@onekeyhq/components/src/layouts/Navigation/Header';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useAllTokenListAtom,
  useAllTokenListMapAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/tokenList';
import { useNotificationsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes, EModalSettingRoutes } from '@onekeyhq/shared/src/routes';
import { EModalNotificationsRoutes } from '@onekeyhq/shared/src/routes/notifications';
import extUtils from '@onekeyhq/shared/src/utils/extUtils';
import notificationsUtils from '@onekeyhq/shared/src/utils/notificationsUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../hooks/useAppNavigation';
import { UrlAccountNavHeader } from '../../views/Home/pages/urlAccount/UrlAccountNavHeader';
import useScanQrCode from '../../views/ScanQrCode/hooks/useScanQrCode';
import { showNotificationPermissionsDialog } from '../PermissionsDialog';

import { UniversalSearchInput } from './UniversalSearchInput';

export function HeaderRight({
  sceneName,
}: {
  sceneName: EAccountSelectorSceneName;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const scanQrCode = useScanQrCode();
  const [{ firstTimeGuideOpened, badge }, setNotificationsData] =
    useNotificationsAtom();
  const {
    activeAccount: { account },
  } = useActiveAccount({ num: 0 });
  const [allTokens] = useAllTokenListAtom();
  const [map] = useAllTokenListMapAtom();
  const openSettingPage = useCallback(() => {
    navigation.pushModal(EModalRoutes.SettingModal, {
      screen: EModalSettingRoutes.SettingListModal,
    });
  }, [navigation]);
  const onScanButtonPressed = useCallback(
    () =>
      scanQrCode.start({
        handlers: scanQrCode.PARSE_HANDLER_NAMES.all,
        autoHandleResult: true,
        account,
        tokens: {
          data: allTokens.tokens,
          keys: allTokens.keys,
          map,
        },
      }),
    [scanQrCode, account, allTokens, map],
  );

  const media = useMedia();
  const openNotificationsModal = useCallback(async () => {
    if (!firstTimeGuideOpened) {
      showNotificationPermissionsDialog();
      setNotificationsData((v) => ({
        ...v,
        firstTimeGuideOpened: true,
      }));
      return;
    }
    navigation.pushModal(EModalRoutes.NotificationsModal, {
      screen: EModalNotificationsRoutes.NotificationList,
    });
  }, [firstTimeGuideOpened, navigation, setNotificationsData]);

  const items = useMemo(() => {
    const settingsButton = (
      <HeaderIconButton
        key="setting"
        title={intl.formatMessage({ id: ETranslations.settings_settings })}
        icon="SettingsOutline"
        testID="setting"
        onPress={openSettingPage}
      />
    );

    const routeInfo = {
      routes: '',
    };
    const layoutExtView = (
      <ActionList
        title={intl.formatMessage({
          id: ETranslations.global_layout,
        })}
        items={[
          platformEnv.isExtensionUiPopup
            ? {
                label: intl.formatMessage({
                  id: ETranslations.open_as_sidebar,
                }),
                icon: 'LayoutRightOutline',
                onPress: async () => {
                  await extUtils.openPanelOnActionClick(true);
                  await extUtils.openSidePanel(routeInfo);
                  window.close();
                },
              }
            : {
                label: intl.formatMessage({
                  id: ETranslations.open_as_popup,
                }),
                icon: 'LayoutTopOutline',
                onPress: async () => {
                  await extUtils.openPanelOnActionClick(false);
                  window.close();
                },
              },
          {
            label: intl.formatMessage({
              id: ETranslations.global_expand_view,
            }),
            icon: 'ExpandOutline',
            onPress: async () => {
              window.close();
              await backgroundApiProxy.serviceApp.openExtensionExpandTab(
                routeInfo,
              );
            },
          },
        ]}
        renderTrigger={
          <HeaderIconButton
            key="layoutRightView"
            title={intl.formatMessage({ id: ETranslations.global_layout })}
            icon="LayoutRightOutline"
          />
        }
      />
    );
    const scanButton = (
      <HeaderIconButton
        key="scan"
        title={intl.formatMessage({ id: ETranslations.scan_scan_qr_code })}
        icon="ScanOutline"
        onPress={onScanButtonPressed}
      />
    );
    const notificationsButton = (
      <Stack>
        <HeaderIconButton
          key="notifications"
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
            borderRadius="$full"
            bg="$bgApp"
            position="absolute"
            right="$-2.5"
            top="$-2"
            borderWidth={2}
            borderColor="$transparent"
            pointerEvents="none"
          >
            <Stack
              px="$1"
              borderRadius="$full"
              bg="$bgCriticalStrong"
              minWidth="$4"
              minHeight="$4"
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
                  {notificationsUtils.formatBadgeNumber(badge)}
                </SizableText>
              )}
            </Stack>
          </Stack>
        ) : null}
      </Stack>
    );
    const searchInput = media.gtMd ? (
      <UniversalSearchInput key="searchInput" />
    ) : null;

    if (sceneName === EAccountSelectorSceneName.homeUrlAccount) {
      return [
        platformEnv.isNative ? null : (
          <UrlAccountNavHeader.OpenInApp key="urlAccountOpenInApp" />
        ),
        <UrlAccountNavHeader.Share key="urlAccountShare" />,
      ].filter(Boolean);
    }

    if (platformEnv.isExtensionUiPopup || platformEnv.isExtensionUiSidePanel) {
      return [layoutExtView, notificationsButton, settingsButton];
    }

    return [scanButton, notificationsButton, settingsButton, searchInput];
  }, [
    intl,
    openSettingPage,
    onScanButtonPressed,
    openNotificationsModal,
    badge,
    firstTimeGuideOpened,
    media.gtMd,
    sceneName,
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
