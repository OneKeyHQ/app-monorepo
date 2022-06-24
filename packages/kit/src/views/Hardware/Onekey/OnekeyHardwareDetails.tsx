import React, { FC, useEffect, useMemo, useState } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Container,
  Icon,
  Modal,
  ToastManager,
} from '@onekeyhq/components';
import { OneKeyHardwareError } from '@onekeyhq/engine/src/errors';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import Protected from '@onekeyhq/kit/src/components/Protected';
import {
  OnekeyHardwareModalRoutes,
  OnekeyHardwareRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/HardwareOnekey';
import { HardwareUpdateModalRoutes } from '@onekeyhq/kit/src/routes/Modal/HardwareUpdate';
import { ModalRoutes, RootRoutes } from '@onekeyhq/kit/src/routes/types';
import { IOneKeyDeviceFeatures } from '@onekeyhq/shared/types';

import { useSettings } from '../../../hooks/redux';
import {
  getDeviceFirmwareVersion,
  getDeviceSerialNo,
} from '../../../utils/hardware/OneKeyHardware';

type RouteProps = RouteProp<
  OnekeyHardwareRoutesParams,
  OnekeyHardwareModalRoutes.OnekeyHardwareDetailsModal
>;

type OnekeyHardwareDetailsModalProps = {
  walletId: string;
};

const OnekeyHardwareDetails: FC<OnekeyHardwareDetailsModalProps> = ({
  walletId,
}) => {
  const intl = useIntl();
  const navigation = useNavigation();
  const { engine, serviceHardware } = backgroundApiProxy;
  const { deviceUpdates } = useSettings();

  const [deviceFeatures, setDeviceFeatures] = useState<IOneKeyDeviceFeatures>();

  const serialNo = useMemo(
    () => getDeviceSerialNo(deviceFeatures),
    [deviceFeatures],
  );

  const updates = useMemo(
    () => deviceUpdates?.[serialNo],
    [deviceUpdates, serialNo],
  );

  useEffect(() => {
    (async () => {
      try {
        const device = await engine.getHWDeviceByWalletId(walletId);
        const features = await serviceHardware.getFeatures(device?.mac ?? '');
        setDeviceFeatures(features ?? null);
      } catch (err) {
        if (navigation.canGoBack()) {
          navigation.goBack();
        }
        if (err instanceof OneKeyHardwareError) {
          ToastManager.show({
            title: intl.formatMessage({ id: err.key }),
          });
        } else {
          ToastManager.show({
            title: intl.formatMessage({
              id: 'action__connection_timeout',
            }),
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
          describe={serialNo ?? '-'}
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
          title={intl.formatMessage({ id: 'content__firmware_version' })}
          describe={getDeviceFirmwareVersion(deviceFeatures).join('.')}
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

      {/* <Container.Box mt={6}>
              <Container.Item
                onPress={() => {}}
                hasArrow
                titleColor="text-default"
                describeColor="text-subdued"
                describe="Not Passed"
                title="Verification"
              />
            </Container.Box> */}
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
            {() => <OnekeyHardwareDetails walletId={walletId} />}
          </Protected>
        ),
      }}
    />
  );
};

export default OnekeyHardwareDetailsModal;
