import { useCallback, useEffect } from 'react';

import { useIntl } from 'react-intl';

import { Page, XStack, YStack, useMedia } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import {
  ProviderJotaiContextDeviceDetails,
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

import type { AllFirmwareRelease } from '@onekeyfe/hd-core';
import type { EFirmwareType } from '@onekeyfe/hd-shared';

function DeviceGetStartedLayout() {
  const { gtXl } = useMedia();
  const { isModalStack } = useDeviceManagerModalStyle();

  if (!gtXl || isModalStack) {
    return null;
  }

  return (
    <YStack width={320}>
      <DeviceGetStarted />
    </YStack>
  );
}

function DeviceDetailsModalV2Cmp({ walletId }: { walletId: string }) {
  const intl = useIntl();
  const { refresh } = useDeviceDetailsActions();
  const { handleBackPress } = useDeviceBackNavigation();

  const isQrWallet = accountUtils.isQrWallet({ walletId });

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
      actions.openChangeLogModal({
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
      <DeviceUpdateAlert type="top" />
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
              <DeviceBasicInfo />
              {isQrWallet ? (
                <DeviceSectionQrInfo />
              ) : (
                <>
                  <DeviceUpdateAlert type="bottom" />
                  <DeviceSectionSupport
                    onPressCheckForUpdates={onPressCheckForUpdates}
                  />
                  <DeviceSectionGeneral />
                  <DeviceSectionSecurity />
                  <DeviceSectionAdvance />
                  <DeviceSectionDeviceConnect />
                  <DeviceSectionDangerZone
                    onPressCheckForUpdates={onPressCheckForUpdates}
                  />
                </>
              )}
            </YStack>
            <DeviceGetStartedLayout />
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
  const { walletId } = (route.params as { walletId: string }) || {
    walletId: '',
  };

  return (
    <AccountSelectorProviderMirror
      config={{ sceneName: EAccountSelectorSceneName.home }}
      enabledNum={[0]}
    >
      <ProviderJotaiContextDeviceDetails>
        <DeviceDetailsModalV2Cmp walletId={walletId} />
      </ProviderJotaiContextDeviceDetails>
    </AccountSelectorProviderMirror>
  );
}

export default DeviceDetailsModal;
