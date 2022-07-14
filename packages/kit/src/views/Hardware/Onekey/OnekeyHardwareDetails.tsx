import React, { FC, useEffect, useMemo, useState } from 'react';

import { getDeviceUUID } from '@onekeyfe/hd-core';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Container,
  Icon,
  Modal,
  ToastManager,
} from '@onekeyhq/components';
import { OneKeyErrorClassNames } from '@onekeyhq/engine/src/errors';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import Protected from '@onekeyhq/kit/src/components/Protected';
import { useSettings } from '@onekeyhq/kit/src/hooks/redux';
import {
  OnekeyHardwareModalRoutes,
  OnekeyHardwareRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/HardwareOnekey';
import { HardwareUpdateModalRoutes } from '@onekeyhq/kit/src/routes/Modal/HardwareUpdate';
import { ModalRoutes, RootRoutes } from '@onekeyhq/kit/src/routes/types';
import { getDeviceFirmwareVersion } from '@onekeyhq/kit/src/utils/hardware/OneKeyHardware';
import { IOneKeyDeviceFeatures } from '@onekeyhq/shared/types';

type RouteProps = RouteProp<
  OnekeyHardwareRoutesParams,
  OnekeyHardwareModalRoutes.OnekeyHardwareDetailsModal
>;

type OnekeyHardwareDetailsModalProps = {
  walletId: string;
  deviceFeatures?: IOneKeyDeviceFeatures;
};

const OnekeyHardwareDetails: FC<OnekeyHardwareDetailsModalProps> = ({
  walletId,
  deviceFeatures,
}) => {
  const intl = useIntl();
  const navigation = useNavigation();
  const { engine, serviceHardware } = backgroundApiProxy;
  const { deviceUpdates } = useSettings() || {};

  const [deviceConnectId, setDeviceConnectId] = useState<string>();

  const updates = useMemo(
    () => deviceUpdates?.[deviceConnectId ?? ''],
    [deviceUpdates, deviceConnectId],
  );

  useEffect(() => {
    (async () => {
      try {
        const device = await engine.getHWDeviceByWalletId(walletId);
        setDeviceConnectId(device?.mac);
      } catch (err: any) {
        if (navigation.canGoBack()) {
          navigation.goBack();
        }

        const { className, key } = err || {};
        if (className === OneKeyErrorClassNames.OneKeyHardwareError) {
          ToastManager.show(
            {
              title: intl.formatMessage({ id: key }),
            },
            { type: 'error' },
          );
        } else {
          ToastManager.show({
            title: intl.formatMessage(
              {
                id: 'action__connection_timeout',
              },
              { type: 'error' },
            ),
          });
        }
      }
    })();
  }, [engine, intl, navigation, serviceHardware, walletId]);

  return (
    <Box
      flexDirection="column"
      p={0.5}
      alignItems="center"
      mb={{ base: 4, md: 0 }}
    >
      {(updates?.ble || updates?.firmware) && (
        <Container.Box mb={4}>
          <Container.Item
            onPress={() => {
              navigation.navigate(RootRoutes.Modal, {
                screen: ModalRoutes.HardwareUpdate,
                params: {
                  screen: HardwareUpdateModalRoutes.HardwareUpdateInfoModel,
                  params: {
                    walletId,
                    onSuccess: () => {
                      if (navigation.canGoBack()) {
                        navigation.goBack();
                      }
                    },
                  },
                },
              });
            }}
            titleColor="text-default"
            title={intl.formatMessage({ id: 'action__update_available' })}
            subDescribeCustom={
              <Icon name="InformationCircleSolid" color="icon-success" />
            }
          />
        </Container.Box>
      )}

      <Container.Box>
        <Container.Item
          titleColor="text-default"
          describeColor="text-subdued"
          title={intl.formatMessage({ id: 'content__serial_number' })}
          describe={deviceFeatures ? getDeviceUUID(deviceFeatures) : '-'}
        />

        <Container.Item
          titleColor="text-default"
          describeColor="text-subdued"
          title={intl.formatMessage({ id: 'content__firmware_version' })}
          describe={getDeviceFirmwareVersion(deviceFeatures).join('.')}
        />

        <Container.Item
          titleColor="text-default"
          describeColor="text-subdued"
          title={intl.formatMessage({ id: 'content__bluetooth_name' })}
          describe={deviceFeatures?.ble_name ?? '-'}
        />

        <Container.Item
          titleColor="text-default"
          describeColor="text-subdued"
          title={intl.formatMessage({
            id: 'content__bluetooth_firmware_version',
          })}
          describe={deviceFeatures?.ble_ver ?? '-'}
        />
      </Container.Box>

      <Container.Box mt={6}>
        <Container.Item
          onPress={() => {
            navigation.navigate(RootRoutes.Modal, {
              screen: ModalRoutes.OnekeyHardware,
              params: {
                screen: OnekeyHardwareModalRoutes.OnekeyHardwareVerifyModal,
                params: {
                  walletId,
                },
              },
            });
          }}
          hasArrow
          titleColor="text-default"
          describeColor="text-subdued"
          title={intl.formatMessage({ id: 'action__verify' })}
        />
      </Container.Box>
    </Box>
  );
};

/**
 * 硬件详情
 */
const OnekeyHardwareDetailsModal: FC = () => {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const { walletId } = route?.params;

  return (
    <Modal
      header={intl.formatMessage({ id: 'action__view_device_details' })}
      headerDescription=""
      footer={null}
      scrollViewProps={{
        children: (
          <Protected walletId={walletId}>
            {(_, { deviceFeatures }) => (
              <OnekeyHardwareDetails
                walletId={walletId}
                deviceFeatures={deviceFeatures}
              />
            )}
          </Protected>
        ),
      }}
    />
  );
};

export default OnekeyHardwareDetailsModal;
