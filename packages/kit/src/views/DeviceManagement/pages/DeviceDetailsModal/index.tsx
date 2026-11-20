import { useCallback, useEffect, useRef } from 'react';

import { useFocusEffect } from '@react-navigation/core';

import { YStack } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import {
  ProviderJotaiContextDeviceDetails,
  useDeviceAtom,
  useDeviceDetailsActions,
  useDeviceMetaStateAtom,
  useRefreshSettledAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/deviceDetails';
import { useFirmwareUpdateActions } from '@onekeyhq/kit/src/views/FirmwareUpdate/hooks/useFirmwareUpdateActions';
import { PrimeGiftOffer } from '@onekeyhq/kit/src/views/Prime/components/PrimeGiftOffer';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import type {
  EModalDeviceManagementRoutes,
  ETabDeviceManagementRoutes,
  IModalDeviceManagementParamList,
  ITabDeviceManagementParamList,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { useDeviceBackNavigation } from '../../hooks/useDeviceBackNavigation';

import DeviceBasicInfo from './DeviceBasicInfo';
import {
  DeviceDetailsPageFrame,
  DeviceDetailsPlaceholder,
  useDeviceDetailsHelpSidebar,
  useDeviceDetailsPlaceholderDelay,
} from './DeviceDetailsFrame';
import { DeviceHelpSidebar } from './DeviceHelpSidebar';
import DeviceSectionAdvance from './DeviceSectionAdvance';
import DeviceSectionDangerZone from './DeviceSectionDangerZone';
import DeviceSectionDeviceConnect from './DeviceSectionDeviceConnect';
import DeviceSectionGeneral, {
  useDeviceGeneralOptions,
} from './DeviceSectionGeneral';
import DeviceSectionQrInfo from './DeviceSectionQrInfo';
import DeviceSectionSecurity from './DeviceSectionSecurity';
import DeviceSectionSupport from './DeviceSectionSupport';
import DeviceSectionTrezorDebug from './DeviceSectionTrezorDebug';
import {
  buildDeviceDetailsVisibility,
  shouldShowDeviceInteractiveSections,
  syncRelevantDeviceStateEvent,
} from './utils';

import type { AllFirmwareRelease } from '@onekeyfe/hd-core';
import type { EFirmwareType } from '@onekeyfe/hd-shared';

function DeviceDetailsModalV2Cmp({
  walletId,
  initialDeviceVendor,
}: {
  walletId: string;
  initialDeviceVendor?: EHardwareVendor;
}) {
  const placeholderDelay = useDeviceDetailsPlaceholderDelay();
  const localActions = useDeviceDetailsActions();
  const { applyDeviceStateEvent, refresh } = localActions;
  const { handleBackPress } = useDeviceBackNavigation();

  const isQrWallet = accountUtils.isQrWallet({ walletId });
  const [device] = useDeviceAtom();
  const [deviceMetaState] = useDeviceMetaStateAtom();
  const [devSettings] = useDevSettingsPersistAtom();
  const deviceVendor = device?.vendor ?? initialDeviceVendor;
  // DEV-ONLY Trezor THP debug tools, shown only in developer mode.
  const showTrezorDebug =
    devSettings.enabled && deviceVendor === EHardwareVendor.trezor;
  const hasLoadedDevice = isQrWallet || Boolean(device);
  const showInteractiveSections = shouldShowDeviceInteractiveSections(
    device?.deviceType,
    deviceMetaState.isReady,
  );
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
  const showSettingsSections = showDeviceSettings && showInteractiveSections;

  // A refresh that settles without a device falls through to the degraded
  // header rather than waiting on a placeholder that would never leave.
  const [refreshSettled] = useRefreshSettledAtom();
  // The column arrives in one frame, once the device's refresh has settled
  // and the General rows are known: their option lists load from the
  // hardware SDK after the device does (and need its model), and revealing
  // before them would grow General under the reader a frame later.
  // Latched, so a later reload updates rows in place.
  const { options: generalOptions, isCurrent: generalOptionsCurrent } =
    useDeviceGeneralOptions();
  const sectionsRevealedRef = useRef(false);
  if (
    hasLoadedDevice &&
    refreshSettled &&
    (!showSettingsSections || generalOptionsCurrent)
  ) {
    sectionsRevealedRef.current = true;
  }
  const sectionsRevealed = sectionsRevealedRef.current;
  const loading = !sectionsRevealed && !(refreshSettled && !hasLoadedDevice);

  const refreshCurrentDevice = useCallback(async () => {
    if (!walletId) return;
    // 设备详情页打开时优先展示已持久化的设备状态，避免页面聚焦就主动
    // 建立连接，尤其是在没有已绑定 BLE connectId 时触发后台搜索/配对。
    const data = await refresh(walletId, { skipDeviceStateSnapshot: true });
    if (!data) {
      void handleBackPress?.();
    }
  }, [refresh, walletId, handleBackPress]);

  const refreshConfirmedState = useCallback(
    async (
      event: IAppEventBusPayload[EAppEventBusNames.HardwareDeviceStateUpdate],
    ) => {
      if (!walletId) return;
      await syncRelevantDeviceStateEvent({
        event,
        applyEvent: applyDeviceStateEvent,
        refresh: () => refresh(walletId, { skipDeviceStateSnapshot: true }),
      });
    },
    [applyDeviceStateEvent, refresh, walletId],
  );

  const refreshLegacyFeatures = useCallback(async () => {
    if (!walletId) return;
    await refresh(walletId, { skipDeviceStateSnapshot: true });
  }, [refresh, walletId]);

  useFocusEffect(
    useCallback(() => {
      void refreshCurrentDevice();
    }, [refreshCurrentDevice]),
  );

  useEffect(() => {
    const refreshAfterFirmwareUpdate = async () => {
      await refresh(walletId, { refreshFirmwareInfo: true });
    };
    appEventBus.on(EAppEventBusNames.WalletUpdate, refreshCurrentDevice);
    appEventBus.on(
      EAppEventBusNames.HardwareDeviceStateUpdate,
      refreshConfirmedState,
    );
    appEventBus.on(
      EAppEventBusNames.HardwareFeaturesUpdate,
      refreshLegacyFeatures,
    );
    appEventBus.on(
      EAppEventBusNames.FinishFirmwareUpdate,
      refreshAfterFirmwareUpdate,
    );
    return () => {
      appEventBus.off(EAppEventBusNames.WalletUpdate, refreshCurrentDevice);
      appEventBus.off(
        EAppEventBusNames.HardwareDeviceStateUpdate,
        refreshConfirmedState,
      );
      appEventBus.off(
        EAppEventBusNames.HardwareFeaturesUpdate,
        refreshLegacyFeatures,
      );
      appEventBus.off(
        EAppEventBusNames.FinishFirmwareUpdate,
        refreshAfterFirmwareUpdate,
      );
    };
  }, [
    refresh,
    refreshConfirmedState,
    refreshCurrentDevice,
    refreshLegacyFeatures,
    walletId,
  ]);

  const actions = useFirmwareUpdateActions();
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

  const showHelpSidebar = useDeviceDetailsHelpSidebar({
    walletId,
    vendor: deviceVendor,
  });

  return (
    <DeviceDetailsPageFrame
      showHelpSidebar={showHelpSidebar}
      sidebar={<DeviceHelpSidebar />}
      testID="device-details-content"
    >
      {loading ? (
        <DeviceDetailsPlaceholder
          delay={placeholderDelay}
          withTroubleshooting={!showHelpSidebar}
        />
      ) : (
        // The offer shares the header's slot so a 0-height entrance does
        // not consume the column gap.
        <YStack w="100%">
          <DeviceBasicInfo
            showFirmwareVersion={Boolean(vendorProfile?.firmware.showVersion)}
            showDeviceVerification={Boolean(vendorProfile?.firmware.verify)}
            showFirmwareUpdate={showFirmwareActions}
          />
          {device && !isQrWallet ? (
            <PrimeGiftOffer device={device} source="deviceDetails" />
          ) : null}
        </YStack>
      )}
      {sectionsRevealed ? (
        <>
          {isQrWallet ? <DeviceSectionQrInfo /> : null}
          {showDeviceSupport ? (
            <DeviceSectionSupport
              onPressCheckForUpdates={onPressCheckForUpdates}
              showFirmwareVerify={Boolean(vendorProfile?.firmware.verify)}
              showFirmwareUpdate={Boolean(vendorProfile?.firmware.update)}
              showTroubleshooting={!showHelpSidebar}
            />
          ) : null}
          {showSettingsSections ? (
            <>
              {generalOptions ? (
                <DeviceSectionGeneral options={generalOptions} />
              ) : null}
              <DeviceSectionSecurity />
            </>
          ) : null}
          {showPassphraseSettings && showInteractiveSections ? (
            <DeviceSectionAdvance />
          ) : null}
          {showDeviceConnection ? <DeviceSectionDeviceConnect /> : null}
          {/* Last of the user-facing sections so a destructive action is
                never adjacent to the routine settings above. Wipe device is
                a OneKey-SDK op; the danger zone is wipe-only for third-party
                (Trezor/Ledger), so hide it for them. */}
          {showDeviceSettings && !vendorProfile?.isThirdParty ? (
            <DeviceSectionDangerZone
              onPressCheckForUpdates={onPressCheckForUpdates}
            />
          ) : null}
          {showTrezorDebug ? <DeviceSectionTrezorDebug /> : null}
        </>
      ) : null}
    </DeviceDetailsPageFrame>
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
