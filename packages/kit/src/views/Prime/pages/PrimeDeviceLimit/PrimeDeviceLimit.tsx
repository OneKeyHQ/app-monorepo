import { useIntl } from 'react-intl';

import {
  Dialog,
  Page,
  SizableText,
  Spinner,
  Stack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import useFormatDate from '@onekeyhq/kit/src/hooks/useFormatDate';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { usePrimeAuthV2 } from '../../hooks/usePrimeAuthV2';

export default function PrimeDeviceLimit() {
  const intl = useIntl();
  const { logout } = usePrimeAuthV2();
  const navigation = useAppNavigation();
  const { formatDistanceToNow } = useFormatDate();
  const [{ instanceId: currentInstanceId }] = useSettingsPersistAtom();

  const { result: devices, isLoading } = usePromiseResult(
    async () => backgroundApiProxy.servicePrime.apiGetPrimeUserDevices(),
    [],
    {
      watchLoading: true,
    },
  );

  const logoutCurrentDevice = async () => {
    await logout();
  };

  const logoutOtherDevices = async ({
    instanceId,
    deviceName,
  }: {
    instanceId: string;
    deviceName: string;
  }) => {
    Dialog.show({
      icon: 'LogoutOutline',
      title: `Logout on ${deviceName}`,
      description: `This device will be logged out on next use and will no longer have access to Prime benefits`,
      onConfirmText: 'Logout',
      onConfirm: async () => {
        await backgroundApiProxy.servicePrime.apiLogoutPrimeUserDevice({
          instanceId,
        });
        navigation.popStack();
      },
    });
  };

  console.log(devices);
  return (
    <Page scrollEnabled>
      <Page.Header
        dismissOnOverlayPress={false}
        disableClose={!platformEnv.isDev}
        headerTitle="Device management"
      />
      <Page.Body>
        <Stack pt="$4" px="$4">
          <SizableText>Devices:</SizableText>
          <Stack py="$4">
            {isLoading ? <Spinner /> : null}
            {devices?.map((device) => (
              <ListItem
                key={device.instanceId}
                icon="PlaceholderOutline"
                title={device.deviceName}
                subtitle={`${device.platform} ${device.instanceId?.slice(
                  0,
                  8,
                )} * ${formatDistanceToNow(new Date(device.lastLoginTime))}`}
              >
                <ListItem.IconButton
                  icon="CrossedLargeOutline"
                  onPress={async () => {
                    await logoutOtherDevices({
                      deviceName: device.deviceName,
                      instanceId: device.instanceId,
                    });
                  }}
                />
              </ListItem>
            ))}
          </Stack>
          <SizableText>
            You can use OneKey Prime on up to 5 devices simultaneously.
          </SizableText>
        </Stack>
      </Page.Body>
      <Page.Footer
        onCancel={async () => {
          await logoutCurrentDevice();
        }}
        onCancelText={`Logout current device: ${currentInstanceId.slice(0, 8)}`}
      />
    </Page>
  );
}
