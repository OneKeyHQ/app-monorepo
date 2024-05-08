import { useCallback, useMemo } from 'react';

import {
  HeaderButtonGroup,
  HeaderIconButton,
} from '@onekeyhq/components/src/layouts/Navigation/Header';
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
  const navigation = useAppNavigation();
  const scanQrCode = useScanQrCode();
  const openSettingPage = useCallback(() => {
    navigation.pushModal(EModalRoutes.SettingModal, {
      screen: EModalSettingRoutes.SettingListModal,
    });
  }, [navigation]);
  const onScanButtonPressed = useCallback(
    () => scanQrCode.start(),
    [scanQrCode],
  );

  const openExtensionExpandTab = useCallback(async () => {
    await backgroundApiProxy.serviceApp.openExtensionExpandTab({
      routes: '',
    });
  }, []);

  const items = useMemo(() => {
    const settingsButton = (
      <HeaderIconButton
        key="setting"
        title="Settings"
        icon="SettingsOutline"
        testID="setting"
        onPress={openSettingPage}
      />
    );
    const expandExtView = (
      <HeaderIconButton
        key="expandExtView"
        title="Expand View"
        icon="CameraExposureSquareOutline"
        onPress={openExtensionExpandTab}
      />
    );
    const scanButton = (
      <HeaderIconButton
        key="scan"
        title="Scan"
        icon="ScanOutline"
        onPress={onScanButtonPressed}
      />
    );
    const searchInput = <UniversalSearchInput key="searchInput" />;

    if (sceneName === EAccountSelectorSceneName.homeUrlAccount) {
      return [
        <UrlAccountNavHeader.OpenInApp key="urlAccountOpenInApp" />,
        <UrlAccountNavHeader.Share key="urlAccountShare" />,
      ];
    }

    if (platformEnv.isExtensionUiPopup) {
      return [expandExtView, settingsButton];
    }

    return [scanButton, settingsButton, searchInput];
  }, [onScanButtonPressed, openExtensionExpandTab, openSettingPage, sceneName]);
  return (
    <HeaderButtonGroup testID="Wallet-Page-Header-Right">
      {items}
    </HeaderButtonGroup>
  );
}
