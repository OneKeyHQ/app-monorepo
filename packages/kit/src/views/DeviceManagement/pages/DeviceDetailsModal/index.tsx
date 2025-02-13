import { useCallback, useEffect } from 'react';

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

  const {
    result,
    isLoading,
    run: refreshData,
  } = usePromiseResult<IHwQrWalletWithDevice | undefined>(async () => {
    const r =
      await backgroundApiProxy.serviceAccount.getAllHwQrWalletWithDevice();
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

  useEffect(() => {
    console.log('result: ====>>>>>>: ', result);
  }, [result]);

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

  const isQrWallet = result
    ? accountUtils.isQrWallet({ walletId: result.wallet.id })
    : false;

  const renderContent = useCallback(() => {
    if (isLoading || !result) {
      return null;
    }

    if (isQrWallet) {
      return <DeviceQrInfoSection />;
    }

    return (
      <>
        <DeviceAdvanceSection data={result} />
        <DeviceSpecsSection data={result} />
      </>
    );
  }, [isLoading, result, isQrWallet]);

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
