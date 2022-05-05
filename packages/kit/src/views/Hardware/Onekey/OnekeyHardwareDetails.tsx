import React, { FC, useEffect } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import { RouteProp } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Box, Container, Icon, Modal } from '@onekeyhq/components';

import {
  OnekeyHardwareModalRoutes,
  OnekeyHardwareRoutesParams,
} from '../../../routes/Modal/HardwareOnekey';
import {
  ModalRoutes,
  ModalScreenProps,
  RootRoutes,
  RootRoutesParams,
} from '../../../routes/types';

type NavigationProps = ModalScreenProps<RootRoutesParams>;
type RouteProps = RouteProp<
  OnekeyHardwareRoutesParams,
  OnekeyHardwareModalRoutes.OnekeyHardwareDetailsModal
>;

/**
 * 硬件详情
 */
const OnekeyHardwareDetails: FC = () => {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<NavigationProps['navigation']>();
  const { walletId } = route?.params;

  useEffect(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.OnekeyHardware,
      params: {
        screen: OnekeyHardwareModalRoutes.OnekeyHardwareConnectModal,
        params: {
          walletId,
        },
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Modal
      header={intl.formatMessage({ id: 'action__view_device_details' })}
      headerDescription=""
      footer={null}
      scrollViewProps={{
        pt: 4,
        children: (
          <Box
            flexDirection="column"
            p={0.5}
            alignItems="center"
            mb={{ base: 4, md: 0 }}
          >
            <Container.Box mt={6}>
              <Container.Item
                onPress={() => {}}
                titleColor="text-default"
                title="Update Available"
                subDescribeCustom={
                  <Icon name="InformationCircleSolid" color="icon-success" />
                }
              />
            </Container.Box>

            <Container.Box mt={6}>
              <Container.Item
                titleColor="text-default"
                describeColor="text-subdued"
                title="Serial Number"
                describe="Bixin21042001987"
              />
              <Container.Item
                titleColor="text-default"
                describeColor="text-subdued"
                title="Bluetooth Name"
                describe="K8101"
              />
              <Container.Item
                titleColor="text-default"
                describeColor="text-subdued"
                title="Firmware Version"
                describe="2.1.7"
              />
              <Container.Item
                titleColor="text-default"
                describeColor="text-subdued"
                title="Bluetooth Firmware Version"
                describe="1.2.1"
              />
            </Container.Box>

            <Container.Box mt={6}>
              <Container.Item
                onPress={() => {}}
                hasArrow
                titleColor="text-default"
                describeColor="text-subdued"
                describe="Not Passed"
                title="Verification"
              />
            </Container.Box>
          </Box>
        ),
      }}
    />
  );
};

export default OnekeyHardwareDetails;
