import { useCallback, useEffect, useState } from 'react';

import { EDeviceType } from '@onekeyfe/hd-shared';
import { useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Page, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { FirmwareUpdateReminderAlert } from '@onekeyhq/kit/src/views/FirmwareUpdate/components/HomeFirmwareUpdateReminder';
import { useFirmwareUpdateActions } from '@onekeyhq/kit/src/views/FirmwareUpdate/hooks/useFirmwareUpdateActions';
import { useFirmwareVerifyDialog } from '@onekeyhq/kit/src/views/Onboarding/pages/ConnectHardwareWallet/FirmwareVerifyDialog';
import type { IAccountSelectorStatusAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  useAccountSelectorStatusAtom,
  useFirmwareUpdatesDetectStatusPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IModalDeviceManagementParamList } from '@onekeyhq/shared/src/routes';
import {
  EAccountManagerStacksRoutes,
  EModalDeviceManagementRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IHwQrWalletWithDevice } from '@onekeyhq/shared/types/account';

import DeviceAdvanceSection from './DeviceAdvanceSection';
import DeviceBasicInfoSection from './DeviceBasicInfoSection';
import DeviceQrInfoSection from './DeviceQrInfoSection';
import DeviceSpecsSection from './DeviceSpecsSection';

import type { RouteProp } from '@react-navigation/native';

function DeviceDetailsModalCmp() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const route =
    useRoute<
      RouteProp<
        IModalDeviceManagementParamList,
        EModalDeviceManagementRoutes.DeviceDetailModal
      >
    >();
  const { walletId } = route.params;

  const [passphraseEnabled, setPassphraseEnabled] = useState(false);
  const [pinOnAppEnabled, setPinOnAppEnabled] = useState(false);
  const {
    result,
    isLoading,
    run: refreshData,
  } = usePromiseResult<IHwQrWalletWithDevice | undefined>(
    async () => {
      const r =
        await backgroundApiProxy.serviceAccount.getAllHwQrWalletWithDevice({
          filterHiddenWallet: true,
        });

      const device = r?.[walletId]?.device;
      setPassphraseEnabled(
        Boolean(device?.featuresInfo?.passphrase_protection),
      );
      setPinOnAppEnabled(Boolean(device?.settings?.inputPinOnSoftware));

      return r?.[walletId] ?? undefined;
    },
    [walletId],
    {
      checkIsFocused: false,
    },
  );

  useEffect(() => {
    const fn = () => {
      void refreshData();
    };
    appEventBus.on(EAppEventBusNames.WalletUpdate, fn);
    appEventBus.on(EAppEventBusNames.HardwareFeaturesUpdate, fn);
    appEventBus.on(EAppEventBusNames.FinishFirmwareUpdate, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.WalletUpdate, fn);
      appEventBus.off(EAppEventBusNames.HardwareFeaturesUpdate, fn);
      appEventBus.off(EAppEventBusNames.FinishFirmwareUpdate, fn);
    };
  }, [refreshData]);
  const [, setAccountSelectorStatus] = useAccountSelectorStatusAtom();

  const isQrWallet = result
    ? accountUtils.isQrWallet({ walletId: result.wallet.id })
    : false;

  // Basic Info Section
  const onPressHomescreen = useCallback(() => {
    if (!result?.device) return;
    navigation.pushModal(EModalRoutes.AccountManagerStacks, {
      screen: EAccountManagerStacksRoutes.HardwareHomeScreenModal,
      params: {
        device: result?.device,
      },
    });
  }, [result?.device, navigation]);

  const { showFirmwareVerifyDialog, isLoading: isFirmwareVerifyDialogLoading } =
    useFirmwareVerifyDialog();
  const onPressAuthRequest = useCallback(async () => {
    if (!result?.device) {
      return;
    }
    await showFirmwareVerifyDialog({
      device: result.device,
      features: result.device.featuresInfo,
      onContinue: async ({ checked }) => {
        console.log(checked);
      },
      onClose: async () => {},
    });
  }, [result?.device, showFirmwareVerifyDialog]);

  const actions = useFirmwareUpdateActions();
  const onPressCheckForUpdates = useCallback(() => {
    actions.openChangeLogModal({
      connectId: result?.device?.connectId,
    });
  }, [result?.device?.connectId, actions]);

  const onPressTroubleshooting = useCallback(() => {
    navigation.push(EModalDeviceManagementRoutes.HardwareTroubleshootingModal, {
      walletWithDevice: result,
    });
  }, [navigation, result]);

  // Advance Section
  const inputPinOnSoftwareSupport = [
    EDeviceType.Classic,
    EDeviceType.Mini,
    EDeviceType.Classic1s,
    EDeviceType.ClassicPure,
  ].includes((result?.device?.deviceType || '') as EDeviceType);

  const onPassphraseEnabledChange = useCallback(
    async (value: boolean) => {
      try {
        await backgroundApiProxy.serviceHardware.setPassphraseEnabled({
          walletId: result?.wallet.id || '',
          passphraseEnabled: value,
        });
        setPassphraseEnabled(value);
        setAccountSelectorStatus(
          (prev): IAccountSelectorStatusAtom => ({
            ...prev,
            passphraseProtectionChangedAt: Date.now(),
          }),
        );
      } catch (error) {
        console.error(error);
      }
    },
    [result?.wallet.id, setAccountSelectorStatus],
  );

  const onPinOnAppEnabledChange = useCallback(
    async (value: boolean) => {
      try {
        setPinOnAppEnabled(value);
        await backgroundApiProxy.serviceHardware.setInputPinOnSoftware({
          walletId: result?.wallet.id || '',
          inputPinOnSoftware: value,
        });
      } catch (error) {
        console.error(error);
        setPinOnAppEnabled(!value);
      }
    },
    [result?.wallet.id],
  );

  const [detectStatus] = useFirmwareUpdatesDetectStatusPersistAtom();
  const { result: detectResult } = usePromiseResult(async () => {
    if (!result?.device?.connectId) return undefined;

    const detectInfo = detectStatus?.[result.device.connectId];
    const shouldUpdate =
      detectInfo?.connectId === result.device.connectId &&
      detectInfo?.hasUpgrade;

    return {
      shouldUpdate,
      detectInfo,
    };
  }, [result?.device?.connectId, detectStatus]);

  const renderUpdateAlert = useCallback(() => {
    if (isQrWallet) return null;
    if (!detectResult?.shouldUpdate) return null;

    let message = 'New firmware is available';
    if (detectResult?.detectInfo?.toVersion) {
      message = intl.formatMessage(
        { id: ETranslations.update_firmware_version_available },
        {
          version: detectResult.detectInfo.toVersion,
        },
      );
    } else if (detectResult?.detectInfo?.toVersionBle) {
      message = intl.formatMessage(
        { id: ETranslations.update_bluetooth_version_available },
        {
          version: detectResult.detectInfo.toVersionBle,
        },
      );
    }

    return (
      <FirmwareUpdateReminderAlert
        containerProps={{
          py: '$3.5',
          borderTopWidth: 0,
          borderBottomWidth: 0,
          borderRadius: '$3',
        }}
        message={message}
        onPress={() => {
          actions.openChangeLogModal({ connectId: result?.device?.connectId });
        }}
      />
    );
  }, [intl, actions, result?.device?.connectId, detectResult, isQrWallet]);

  const renderContent = useCallback(() => {
    if (isLoading || !result) {
      return null;
    }

    if (isQrWallet) {
      return <DeviceQrInfoSection />;
    }

    return (
      <>
        <DeviceAdvanceSection
          passphraseEnabled={passphraseEnabled}
          pinOnAppEnabled={pinOnAppEnabled}
          onPassphraseEnabledChange={onPassphraseEnabledChange}
          onPinOnAppEnabledChange={onPinOnAppEnabledChange}
          inputPinOnSoftwareSupport={inputPinOnSoftwareSupport}
        />
        <DeviceSpecsSection data={result} />
      </>
    );
  }, [
    isLoading,
    result,
    isQrWallet,
    passphraseEnabled,
    pinOnAppEnabled,
    inputPinOnSoftwareSupport,
    onPassphraseEnabledChange,
    onPinOnAppEnabledChange,
  ]);

  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.global_about_device })}
      />
      <Page.Body>
        <YStack px="$5" py="$3" gap={isQrWallet ? '$5' : '$3'} bg="$bgApp">
          {result ? (
            <>
              {renderUpdateAlert()}
              <DeviceBasicInfoSection
                data={result}
                onPressHomescreen={onPressHomescreen}
                onPressAuthRequest={onPressAuthRequest}
                authRequestLoading={isFirmwareVerifyDialogLoading}
                onPressCheckForUpdates={onPressCheckForUpdates}
                onPressTroubleshooting={onPressTroubleshooting}
              />
              {renderContent()}
            </>
          ) : null}
        </YStack>
      </Page.Body>
    </Page>
  );
}

function DeviceDetailsModal() {
  return (
    <AccountSelectorProviderMirror
      config={{ sceneName: EAccountSelectorSceneName.home }}
      enabledNum={[0]}
    >
      <DeviceDetailsModalCmp />
    </AccountSelectorProviderMirror>
  );
}

export default DeviceDetailsModal;
