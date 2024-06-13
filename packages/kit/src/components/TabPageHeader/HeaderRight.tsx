import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { useMedia } from '@onekeyhq/components';
import {
  HeaderButtonGroup,
  HeaderIconButton,
} from '@onekeyhq/components/src/layouts/Navigation/Header';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes, EModalSettingRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../hooks/useAppNavigation';
import { UrlAccountNavHeader } from '../../views/Home/pages/urlAccount/UrlAccountNavHeader';
import useScanQrCode from '../../views/ScanQrCode/hooks/useScanQrCode';

import { UniversalSearchInput } from './UniversalSearchInput';

export function HeaderRight({
  sceneName,
}: {
  sceneName: EAccountSelectorSceneName;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const scanQrCode = useScanQrCode();
  const {
    activeAccount: { account },
  } = useActiveAccount({ num: 0 });
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
        accountId: account?.id,
      }),
    [scanQrCode, account?.id],
  );

  const openExtensionExpandTab = useCallback(async () => {
    await backgroundApiProxy.serviceApp.openExtensionExpandTab({
      routes: '',
    });
  }, []);

  const media = useMedia();
  const items = useMemo(() => {
    const settingsButton = (
      <HeaderIconButton
        key="settings"
        title={intl.formatMessage({ id: ETranslations.settings_settings })}
        icon="SettingsOutline"
        testID="setting"
        onPress={openSettingPage}
      />
    );
    const expandExtView = (
      <HeaderIconButton
        key="expandExtView"
        title={intl.formatMessage({ id: ETranslations.global_expand_view })}
        icon="CameraExposureSquareOutline"
        onPress={openExtensionExpandTab}
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

    if (platformEnv.isExtensionUiPopup) {
      return [expandExtView, settingsButton];
    }

    return [scanButton, settingsButton, searchInput];
  }, [
    intl,
    media.gtMd,
    onScanButtonPressed,
    openExtensionExpandTab,
    openSettingPage,
    sceneName,
  ]);
  return (
    <HeaderButtonGroup testID="Wallet-Page-Header-Right">
      {items}
    </HeaderButtonGroup>
  );
}
