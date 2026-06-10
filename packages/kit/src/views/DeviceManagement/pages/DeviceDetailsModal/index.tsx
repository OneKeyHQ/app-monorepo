import { useCallback, useEffect } from 'react';

import { useIntl } from 'react-intl';

import { Page, XStack, YStack, useMedia } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import {
  ProviderJotaiContextDeviceDetails,
  useDeviceAtom,
  useDeviceDetailsActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/deviceDetails';
import { useFirmwareUpdateActions } from '@onekeyhq/kit/src/views/FirmwareUpdate/hooks/useFirmwareUpdateActions';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalDeviceManagementRoutes,
  ETabDeviceManagementRoutes,
  IModalDeviceManagementParamList,
  ITabDeviceManagementParamList,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { useDeviceBackNavigation } from '../../hooks/useDeviceBackNavigation';
import { useDeviceManagerModalStyle } from '../../hooks/useDeviceManagerModalStyle';
import { DeviceCommonHeader } from '../DeviceCommonHeader';

import DeviceBasicInfo from './DeviceBasicInfo';
import DeviceGetStarted from './DeviceGetStarted';
import DeviceSectionAdvance from './DeviceSectionAdvance';
import DeviceSectionDangerZone from './DeviceSectionDangerZone';
import DeviceSectionDeviceConnect from './DeviceSectionDeviceConnect';
import DeviceSectionGeneral from './DeviceSectionGeneral';
import DeviceSectionQrInfo from './DeviceSectionQrInfo';
import DeviceSectionSecurity from './DeviceSectionSecurity';
import DeviceSectionSupport from './DeviceSectionSupport';
import { DeviceUpdateAlert } from './DeviceUpdateAlert';
import { buildDeviceDetailsVisibility } from './utils';

import type { AllFirmwareRelease } from '@onekeyfe/hd-core';
import type { EFirmwareType } from '@onekeyfe/hd-shared';

function DeviceGetStartedLayout({ visible }: { visible: boolean }) {
  const { gtXl } = useMedia();
  const { isModalStack } = useDeviceManagerModalStyle();

  if (!visible || !gtXl || isModalStack) {
    return null;
  }

  return (
    <YStack width={320}>
      <DeviceGetStarted />
    </YStack>
  );
}

function DeviceDetailsModalV2Cmp({
  walletId,
  initialDeviceVendor,
}: {
  walletId: string;
  initialDeviceVendor?: EHardwareVendor;
}) {
  const intl = useIntl();
  const { refresh } = useDeviceDetailsActions();
  const { handleBackPress } = useDeviceBackNavigation();

  const isQrWallet = accountUtils.isQrWallet({ walletId });
  const [device] = useDeviceAtom();
  const deviceVendor = device?.vendor ?? initialDeviceVendor;
  const hasLoadedDevice = isQrWallet || Boolean(device);
  const {
    vendorProfile,
    showFirmwareActions,
    showDeviceSettings,
    showDeviceSupport,
    showPassphraseSettings,
    showDeviceConnection,
  } = buildDeviceDetailsVisibility({
    vendor: deviceVendor,
    isQrWallet,
    hasLoadedDevice,
  });

  useEffect(() => {
    if (!walletId) return;
    const fn = async () => {
      const data = await refresh(walletId);
      if (!data) {
        void handleBackPress?.();
      }
    };
    void fn();
    appEventBus.on(EAppEventBusNames.WalletUpdate, fn);
    appEventBus.on(EAppEventBusNames.HardwareFeaturesUpdate, fn);
    appEventBus.on(EAppEventBusNames.FinishFirmwareUpdate, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.WalletUpdate, fn);
      appEventBus.off(EAppEventBusNames.HardwareFeaturesUpdate, fn);
      appEventBus.off(EAppEventBusNames.FinishFirmwareUpdate, fn);
    };
  }, [refresh, walletId, handleBackPress]);

  const actions = useFirmwareUpdateActions();
  const localActions = useDeviceDetailsActions();

  const onPressCheckForUpdates = useCallback(
    async (
      firmwareType?: EFirmwareType,
      baseReleaseInfo?: AllFirmwareRelease,
    ) => {
      const walletWithDevice = await localActions.getWalletWithDevice();
      if (!walletWithDevice) return;
      await actions.openChangeLogModal({
        connectId: walletWithDevice.device?.connectId,
        firmwareType,
        baseReleaseInfo,
      });
    },
    [localActions, actions],
  );

  return (
    <Page scrollEnabled>
      <DeviceCommonHeader
        title={intl.formatMessage({ id: ETranslations.global_about_device })}
      />
      {showFirmwareActions ? <DeviceUpdateAlert type="top" /> : null}
      <Page.Body
        alignItems="stretch"
        pt="$0"
        pb="$8"
        testID="device-details-content"
        $gtMd={{ pt: '$8' }}
      >
        <Page.Container>
          <XStack bg="$bgApp" gap="$8" alignItems="flex-start">
            <YStack gap="$8" flex={1}>
              <DeviceBasicInfo
                showFirmwareVersion={Boolean(
                  vendorProfile?.supportsFirmwareVersionDisplay,
                )}
                showDeviceVerification={Boolean(
                  vendorProfile?.supportsFirmwareVerify,
                )}
              />
              {isQrWallet ? <DeviceSectionQrInfo /> : null}
              {showFirmwareActions ? <DeviceUpdateAlert type="bottom" /> : null}
              {showDeviceSupport ? (
                <DeviceSectionSupport
                  onPressCheckForUpdates={onPressCheckForUpdates}
                  showFirmwareVerify={Boolean(
                    vendorProfile?.supportsFirmwareVerify,
                  )}
                  showFirmwareUpdate={Boolean(
                    vendorProfile?.supportsFirmwareUpdate,
                  )}
                />
              ) : null}
              {showDeviceSettings ? (
                <>
                  <DeviceSectionGeneral />
                  <DeviceSectionSecurity />
                  <DeviceSectionDangerZone
                    onPressCheckForUpdates={onPressCheckForUpdates}
                  />
                </>
              ) : null}
              {showPassphraseSettings ? <DeviceSectionAdvance /> : null}
              {showDeviceConnection ? <DeviceSectionDeviceConnect /> : null}
            </YStack>
            <DeviceGetStartedLayout visible={showDeviceSettings} />
          </XStack>
        </Page.Container>
      </Page.Body>
    </Page>
  );
}

function DeviceDetailsModal() {
  const route = useAppRoute<
    IModalDeviceManagementParamList | ITabDeviceManagementParamList,
    | EModalDeviceManagementRoutes.DeviceDetailModal
    | ETabDeviceManagementRoutes.DeviceDetail
  >();
  const { walletId, initialDeviceVendor } = (route.params as {
    walletId: string;
    initialDeviceVendor?: EHardwareVendor;
  }) || {
    walletId: '',
    initialDeviceVendor: undefined,
  };

  return (
    <AccountSelectorProviderMirror
      config={{ sceneName: EAccountSelectorSceneName.home }}
      enabledNum={[0]}
    >
      <ProviderJotaiContextDeviceDetails>
        <DeviceDetailsModalV2Cmp
          walletId={walletId}
          initialDeviceVendor={initialDeviceVendor}
        />
      </ProviderJotaiContextDeviceDetails>
    </AccountSelectorProviderMirror>
  );
}

export default DeviceDetailsModal;
