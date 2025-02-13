import { useCallback, useEffect, useState } from 'react';

import { useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Page, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useFirmwareUpdateActions } from '@onekeyhq/kit/src/views/FirmwareUpdate/hooks/useFirmwareUpdateActions';
import { useFirmwareVerifyDialog } from '@onekeyhq/kit/src/views/Onboarding/pages/ConnectHardwareWallet/FirmwareVerifyDialog';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalDeviceManagementRoutes,
  IModalDeviceManagementParamList,
} from '@onekeyhq/shared/src/routes';
import {
  EAccountManagerStacksRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { IHwQrWalletWithDevice } from '@onekeyhq/shared/types/account';

import DeviceAdvanceSection from './DeviceAdvanceSection';
import DeviceBasicInfoSection from './DeviceBasicInfoSection';
import DeviceQrInfoSection from './DeviceQrInfoSection';
import DeviceSpecsSection from './DeviceSpecsSection';

import type { RouteProp } from '@react-navigation/native';

function DeviceDetailsModal() {
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
  } = usePromiseResult<IHwQrWalletWithDevice | undefined>(async () => {
    const r =
      await backgroundApiProxy.serviceAccount.getAllHwQrWalletWithDevice();

    const device = r?.[walletId]?.device;
    setPassphraseEnabled(Boolean(device?.featuresInfo?.passphrase_protection));
    setPinOnAppEnabled(Boolean(device?.settings?.inputPinOnSoftware));

    return r?.[walletId] ?? undefined;
  }, [walletId]);

  useEffect(() => {
    const fn = () => {
      void refreshData();
    };
    appEventBus.on(EAppEventBusNames.WalletUpdate, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.WalletUpdate, fn);
    };
  }, [refreshData]);

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

  const { showFirmwareVerifyDialog } = useFirmwareVerifyDialog();
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
    });
  }, [result?.device, showFirmwareVerifyDialog]);

  const actions = useFirmwareUpdateActions();
  const onPressCheckForUpdates = useCallback(() => {
    actions.openChangeLogModal({
      connectId: result?.device?.connectId,
    });
  }, [result?.device?.connectId, actions]);

  // Advance Section
  const inputPinOnSoftwareSupport = ['classic', 'mini', 'classic1s'].includes(
    result?.device?.deviceType || '',
  );

  const onPassphraseEnabledChange = useCallback(
    async (value: boolean) => {
      try {
        await backgroundApiProxy.serviceHardware.setPassphraseEnabled({
          walletId: result?.wallet.id || '',
          passphraseEnabled: value,
        });
        setPassphraseEnabled(value);
      } catch (error) {
        console.error(error);
      }
    },
    [result?.wallet.id],
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
              <DeviceBasicInfoSection
                data={result}
                onPressHomescreen={onPressHomescreen}
                onPressAuthRequest={onPressAuthRequest}
                onPressCheckForUpdates={onPressCheckForUpdates}
              />
              {renderContent()}
            </>
          ) : null}
        </YStack>
      </Page.Body>
    </Page>
  );
}

export default DeviceDetailsModal;
