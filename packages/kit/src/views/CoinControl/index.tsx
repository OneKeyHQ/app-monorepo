import type { FC } from 'react';
import { useCallback, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  Empty,
  Modal,
  SegmentedControl,
  Token,
} from '@onekeyhq/components';
import type { CoinControlRoutesParams } from '@onekeyhq/kit/src/routes';
import type { CoinControlModalRoutes } from '@onekeyhq/kit/src/routes/routesEnum';

import { useNetwork } from '../../hooks';

import { CoinControlList } from './components/List';

import type { RouteProp } from '@react-navigation/native';

type RouteProps = RouteProp<
  CoinControlRoutesParams,
  CoinControlModalRoutes.CoinControlModal
>;

const ModalHeader: FC<{
  networkId: string;
}> = ({ networkId }) => {
  const { network } = useNetwork({ networkId });
  return (
    <Box>
      <Token
        size={4}
        showInfo
        name={network?.name}
        showName
        showTokenVerifiedIcon={false}
        token={{ name: network?.name, logoURI: network?.logoURI }}
        nameProps={{
          typography: { sm: 'Caption', md: 'Caption' },
          color: 'text-subdued',
          ml: '-6px',
        }}
      />
    </Box>
  );
};

const CoinControl = () => {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const { networkId } = route.params;

  const [selectedIndex, setSelectedIndex] = useState(0);

  return (
    <Modal
      header={intl.formatMessage({ id: 'title__coin_control' })}
      headerDescription={<ModalHeader networkId={networkId} />}
      footer={null}
    >
      <Box mb={4}>
        <SegmentedControl
          values={[
            intl.formatMessage({ id: 'action__available_tab' }),
            intl.formatMessage({ id: 'action__frozen_tab' }),
          ]}
          selectedIndex={selectedIndex}
          onChange={setSelectedIndex}
        />
      </Box>
      {/* <Center flex={1}>
        <Empty
          emoji="🪙"
          title={intl.formatMessage({
            id: 'content__no_coins',
          })}
          subTitle={intl.formatMessage({
            id: 'content__no_utxos_in_this_account',
          })}
        />
      </Center> */}
      <CoinControlList />
    </Modal>
  );
};

export default CoinControl;
