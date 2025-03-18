import type { ReactNode } from 'react';
import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  ActionList,
  SizableText,
  Stack,
  useIsIpadLandscape,
  useMedia,
} from '@onekeyhq/components';
import {
  HeaderButtonGroup,
  HeaderIconButton,
} from '@onekeyhq/components/src/layouts/Navigation/Header';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useAllTokenListAtom,
  useAllTokenListMapAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/tokenList';
import {
  useDevSettingsPersistAtom,
  useNotificationsAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalNotificationsRoutes } from '@onekeyhq/shared/src/routes/notifications';
import extUtils from '@onekeyhq/shared/src/utils/extUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../hooks/useAppNavigation';
import { UrlAccountNavHeader } from '../../views/Home/pages/urlAccount/UrlAccountNavHeader';
import { PrimeHeaderIconButtonLazy } from '../../views/Prime/components/PrimeHeaderIconButton';
import useScanQrCode from '../../views/ScanQrCode/hooks/useScanQrCode';

import { MoreActionButton } from './MoreActionButton';
import { UniversalSearchInput } from './UniversalSearchInput';

const ReactMoreActionButton = platformEnv.isNativeIOSPad
  ? () => {
      const isIpadLandscape = useIsIpadLandscape();
      return isIpadLandscape ? null : <MoreActionButton key="more-action" />;
    }
  : () => {
      const media = useMedia();
      return media.gtMd ? null : <MoreActionButton key="more-action" />;
    };

export function HeaderRight({
  sceneName,
}: {
  sceneName: EAccountSelectorSceneName;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const isIpadLandscape = useIsIpadLandscape();
  const scanQrCode = useScanQrCode();
  const [{ firstTimeGuideOpened, badge }] = useNotificationsAtom();
  const [devSettings] = useDevSettingsPersistAtom();

  const {
    activeAccount: { account },
  } = useActiveAccount({ num: 0 });
  const [allTokens] = useAllTokenListAtom();
  const [map] = useAllTokenListMapAtom();
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
    navigation.pushModal(EModalRoutes.NotificationsModal, {
      screen: EModalNotificationsRoutes.NotificationList,
    });
  }, [navigation]);

  const items = useMemo(() => {
    const scanButton = media.gtMd ? (
      <HeaderIconButton
        key="scan"
        title={intl.formatMessage({ id: ETranslations.scan_scan_qr_code })}
        icon="ScanOutline"
        onPress={onScanButtonPressed}
      />
    ) : null;

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

    const moreActionButton = <ReactMoreActionButton />;

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
      return [primeButton, notificationsButton, moreActionButton].filter(
        Boolean,
      );
    }

    // notifications is not supported on web currently
    if (platformEnv.isWeb && !devSettings.enabled) {
      notificationsButton = null;
    }

    return [
      primeButton,
      scanButton,
      notificationsButton,
      moreActionButton,
      searchInput,
    ].filter(Boolean);
  }, [
    badge,
    devSettings.enabled,
    devSettings?.settings?.showPrimeTest,
    firstTimeGuideOpened,
    intl,
    media.gtMd,
    onScanButtonPressed,
    openNotificationsModal,
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
