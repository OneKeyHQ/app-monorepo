import React, { FC, useEffect, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { RouteProp } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Box, Container, Modal } from '@onekeyhq/components';
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
  const { engine } = backgroundApiProxy;
  const [deviceFeatures, setDeviceFeatures] =
    useState<IOneKeyDeviceFeatures | null>(null);

  useEffect(() => {
    (async () => {
      const device = await engine.getHWDeviceByWalletId(walletId);
      const features = await deviceUtils.getFeatures(device?.mac ?? '');
      setDeviceFeatures(features);
    })();
  }, [engine, walletId]);

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
