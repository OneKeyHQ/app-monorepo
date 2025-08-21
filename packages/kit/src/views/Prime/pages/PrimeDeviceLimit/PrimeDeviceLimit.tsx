import { useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Alert,
  Badge,
  Dialog,
  Page,
  Spinner,
  Stack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import useFormatDate from '@onekeyhq/kit/src/hooks/useFormatDate';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { getAppDeviceIcon } from '@onekeyhq/shared/src/appDeviceInfo/utils/getAppDeviceIcon';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EPrimePages,
  IPrimeParamList,
} from '@onekeyhq/shared/src/routes/prime';

import { usePrimeAuthV2 } from '../../hooks/usePrimeAuthV2';

import type { RouteProp } from '@react-navigation/native';

export default function PrimeDeviceLimit() {
  const { getAccessToken } = usePrimeAuthV2();
  const navigation = useAppNavigation();
  const intl = useIntl();
  const { formatDistanceToNow } = useFormatDate();
  const [{ instanceId: currentInstanceId }] = useSettingsPersistAtom();
  const { params } =
    useRoute<RouteProp<IPrimeParamList, EPrimePages.PrimeDeviceLimit>>();

  const {
    result: devices,
    isLoading,
    run: reloadDevices,
  } = usePromiseResult(
    async () => {
      const token = await getAccessToken();
      if (!token) {
        return;
      }
      return backgroundApiProxy.servicePrime.apiGetPrimeUserDevices({
        accessToken: token || '',
      });
    },
    [getAccessToken],
    {
      watchLoading: true,
    },
  );

  const logoutOtherDevices = async ({
    instanceId,
    deviceName,
  }: {
    instanceId: string;
    deviceName: string;
  }) => {
    Dialog.show({
      icon: 'LogoutOutline',
      title: intl.formatMessage(
        {
          id: ETranslations.prime_log_out_device,
        },
        {
          DeviceName: deviceName,
        },
      ),
      description: intl.formatMessage({
        id: ETranslations.prime_log_out_device_desc,
      }),
      onConfirmText: intl.formatMessage({
        id: ETranslations.global_logout,
      }),
      onConfirm: async () => {
        const token = await getAccessToken();
        await backgroundApiProxy.servicePrime.apiLogoutPrimeUserDevice({
          instanceId,
          accessToken: token || '',
        });
        if (params?.isExceedDeviceLimit) {
          navigation.popStack();
        } else {
          await reloadDevices();
        }
      },
    });
  };

  console.log('PrimeDeviceLimit devices::: ', devices);
  return (
    <Page scrollEnabled>
      <Page.Header
        headerTitle={intl.formatMessage({
          id: ETranslations.prime_device_management,
        })}
      />
      <Page.Body>
        <Stack pb="$4">
          {params?.isExceedDeviceLimit ? (
            <Stack px="$5" pb="$5">
              <Alert
                type="warning"
                title={intl.formatMessage({
                  id: ETranslations.prime_device_limit_reached,
                })}
                description={intl.formatMessage({
                  id: ETranslations.prime_device_limit_reached_desc,
                })}
              />
            </Stack>
          ) : null}

          <Stack>
            {isLoading && !devices?.length ? <Spinner /> : null}
            {devices?.map((device) => {
              let title = '';
              let subtitle = '';

              const appFullNameWithVersion = [device.deviceName, device.version]
                .filter(Boolean)
                .join(' ');
              const instanceIdLastHash = device.instanceId?.slice(0, 8);

              title = `${device.platformName || device.platform}`;
              subtitle = `${appFullNameWithVersion} · ${formatDistanceToNow(
                new Date(device.lastLoginTime),
              )}`;

              if (process.env.NODE_ENV !== 'production') {
                title += ` (${instanceIdLastHash})`;
              }

              return (
                <ListItem
                  key={device.instanceId}
                  icon={getAppDeviceIcon(device)}
                  title={title}
                  subtitle={subtitle}
                >
                  {currentInstanceId === device.instanceId ? (
                    <Badge badgeType="default" badgeSize="lg">
                      {intl.formatMessage({
                        id: ETranslations.prime_current,
                      })}
                    </Badge>
                  ) : (
                    <ListItem.IconButton
                      icon="CrossedLargeOutline"
                      onPress={async () => {
                        await logoutOtherDevices({
                          deviceName: device.deviceName,
                          instanceId: device.instanceId,
                        });
                      }}
                    />
                  )}
                </ListItem>
              );
            })}
          </Stack>
        </Stack>
      </Page.Body>
      {/* <Page.Footer
        onCancel={async () => {
          await logoutCurrentDevice();
        }}
        onCancelText={`Logout current device: ${currentInstanceId.slice(0, 8)}`}
      /> */}
    </Page>
  );
}
