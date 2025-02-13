import { useCallback, useMemo } from 'react';

import { useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Page, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalDeviceManagementRoutes,
  IModalDeviceManagementParamList,
} from '@onekeyhq/shared/src/routes';
import type { IHwQrWalletWithDevice } from '@onekeyhq/shared/types/account';

import DeviceAdvanceSection from './DeviceAdvanceSection';
import DeviceBasicInfoSection from './DeviceBasicInfoSection';
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

  const { result } = usePromiseResult<
    IHwQrWalletWithDevice | undefined
  >(async () => {
    const r =
      await backgroundApiProxy.serviceAccount.getAllHwQrWalletWithDevice();
    return r?.[walletId] ?? undefined;
  }, [walletId]);

  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.global_about_device })}
      />
      <Page.Body>
        <YStack px="$5" py="$3" gap="$3" bg="$bgApp">
          {result ? (
            <>
              <DeviceBasicInfoSection data={result} />
              <DeviceAdvanceSection data={result} />
              <DeviceSpecsSection data={result} />
            </>
          ) : null}
        </YStack>
      </Page.Body>
    </Page>
  );
}

export default DeviceDetailsModal;
