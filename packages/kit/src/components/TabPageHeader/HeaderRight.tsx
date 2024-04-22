import { useCallback } from 'react';

import {
  HeaderButtonGroup,
  HeaderIconButton,
} from '@onekeyhq/components/src/layouts/Navigation/Header';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes, EModalSettingRoutes } from '@onekeyhq/shared/src/routes';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../hooks/useAppNavigation';
import useScanQrCode from '../../views/ScanQrCode/hooks/useScanQrCode';

export function HeaderRight() {
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

  return (
    <HeaderButtonGroup testID="Wallet-Page-Header-Right">
      {platformEnv.isExtensionUiPopup ? (
        <HeaderIconButton
          title="Expand View"
          icon="CameraExposureSquareOutline"
          onPress={openExtensionExpandTab}
        />
      ) : (
        <HeaderIconButton
          title="Scan"
          icon="ScanOutline"
          onPress={onScanButtonPressed}
        />
      )}
      <HeaderIconButton
        title="Settings"
        icon="SettingsOutline"
        testID="setting"
        onPress={openSettingPage}
      />
    </HeaderButtonGroup>
  );
}
