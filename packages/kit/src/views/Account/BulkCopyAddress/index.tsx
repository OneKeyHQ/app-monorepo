import type { FC } from 'react';
import { useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Box, Modal, SegmentedControl, Token } from '@onekeyhq/components';
import type { Network } from '@onekeyhq/engine/src/types/network';

import { useRuntime } from '../../../hooks/redux';

import SetRange from './SetRange';

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

const HeaderDescription: FC<{ network: Network }> = ({
  network,
}: {
  network: Network;
}) => (
  <Token
    size={4}
    showInfo
    showName
    showTokenVerifiedIcon={false}
    token={{
      name: network.name,
      logoURI: network.logoURI,
    }}
    nameProps={{
      typography: { sm: 'Caption', md: 'Caption' },
      color: 'text-subdued',
      ml: '-6px',
    }}
  />
);

const BulkCopyAddress = () => {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const { walletId, networkId } = route.params;
  const { networks } = useRuntime();
  const network = networks.filter((n) => n.id === networkId)[0];

  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  return (
    <Modal
      header={intl.formatMessage({ id: 'title__bulk_copy_addresses' })}
      headerDescription={<HeaderDescription network={network} />}
      hideSecondaryAction
      hidePrimaryAction
      footer={null}
    >
      <Box mb={6}>
        <SegmentedControl
          values={[
            intl.formatMessage({ id: 'form__set_range' }),
            intl.formatMessage({ id: 'form__my_accounts' }),
          ]}
          selectedIndex={selectedIndex}
          onChange={setSelectedIndex}
        />
      </Box>

      <SetRange walletId={walletId} networkId={networkId} />
    </Modal>
  );
};

export default BulkCopyAddress;
