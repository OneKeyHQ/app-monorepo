import React, { FC, useEffect, useState } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Box, Container, Modal, ToastManager } from '@onekeyhq/components';
import { OneKeyHardwareError } from '@onekeyhq/engine/src/errors';
import { IOneKeyDeviceFeatures } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import Protected from '../../../components/Protected';
import {
  OnekeyHardwareModalRoutes,
  OnekeyHardwareRoutesParams,
} from '../../../routes/Modal/HardwareOnekey';
import { deviceUtils } from '../../../utils/hardware';

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
  const { engine } = backgroundApiProxy;
  const [deviceFeatures, setDeviceFeatures] =
    useState<IOneKeyDeviceFeatures | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const device = await engine.getHWDeviceByWalletId(walletId);
        const features = await deviceUtils.getFeatures(device?.mac ?? '');
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
  }, [engine, intl, navigation, walletId]);

  return (
    <Box
      flexDirection="column"
      p={0.5}
      alignItems="center"
      mb={{ base: 4, md: 0 }}
    >
      {/* <Container.Box mt={6}>
              <Container.Item
                onPress={() => {}}
                titleColor="text-default"
                title="Update Available"
                subDescribeCustom={
                  <Icon name="InformationCircleSolid" color="icon-success" />
                }
              />
            </Container.Box> */}

      <Container.Box>
        <Container.Item
          titleColor="text-default"
          describeColor="text-subdued"
          title="Serial Number"
          describe={deviceFeatures?.onekey_serial ?? '-'}
        />

        <Container.Item
          titleColor="text-default"
          describeColor="text-subdued"
          title="Bluetooth Name"
          describe={deviceFeatures?.ble_name ?? '-'}
        />

        <Container.Item
          titleColor="text-default"
          describeColor="text-subdued"
          title="Firmware Version"
          describe={deviceFeatures?.onekey_version ?? '-'}
        />
        <Container.Item
          titleColor="text-default"
          describeColor="text-subdued"
          title="Bluetooth Firmware Version"
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
        pt: 4,
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
