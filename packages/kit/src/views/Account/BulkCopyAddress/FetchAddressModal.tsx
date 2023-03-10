import type { FC } from 'react';
import { useEffect } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Center,
  Modal,
  Progress,
  Text,
} from '@onekeyhq/components';

import type {
  CreateAccountModalRoutes,
  CreateAccountRoutesParams,
} from '../../../routes';
import type { ModalScreenProps } from '../../../routes/types';
import type { RouteProp } from '@react-navigation/native';

type NavigationProps = ModalScreenProps<CreateAccountRoutesParams>;
type RouteProps = RouteProp<
  CreateAccountRoutesParams,
  CreateAccountModalRoutes.BulkCopyAddresses
>;

const FetchAddressModal: FC = () => {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const { walletId, networkId } = route.params;

  return (
    <Modal
      header={undefined}
      footer={null}
      closeable={false}
      closeOnOverlayClick={false}
      hidePrimaryAction
      hideSecondaryAction
      hideBackButton
    >
      <Center>
        <Progress.Circle
          progress={0.21}
          text={
            <Center>
              <Text typography={{ sm: 'DisplayMedium', md: 'DisplayLarge' }}>
                3/5
              </Text>
            </Center>
          }
        />
        <Text my={6} typography={{ sm: 'Heading', md: 'Heading' }}>
          {intl.formatMessage({ id: 'title__fetching_addresses' })}
        </Text>
        <Box w="full">
          <Button flex={1} type="basic" size="lg">
            {intl.formatMessage({ id: 'action__cancel' })}
          </Button>
        </Box>
      </Center>
    </Modal>
  );
};

export default FetchAddressModal;
