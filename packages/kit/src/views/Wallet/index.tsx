import React from 'react';

import { useIntl } from 'react-intl';

import { Box, SceneMap, TabView, useUserDevice } from '@onekeyhq/components';

import AccountInfo from './AccountInfo';
import AssetsList from './AccountList';
import Collectibles from './Collectibles';
import HistoricalRecord from './HistoricalRecords';

const Wallet = () => {
  const { size } = useUserDevice();
  const intl = useIntl();

  return (
    <Box
      flex={1}
      alignItems="center"
      flexDirection="column"
      bg="background-default"
    >
      <Box flex={1} w="100%" flexDirection="column" maxW="1024px">
        {AccountInfo()}
        <Box mt={8} flex={1}>
          <TabView
            paddingX={16}
            autoWidth={!['SMALL'].includes(size)}
            routes={[
              {
                key: 'tokens',
                title: intl.formatMessage({ id: 'asset__tokens' }),
              },
              {
                key: 'collectibles',
                title: intl.formatMessage({ id: 'asset__collectibles' }),
              },
              {
                key: 'history',
                title: intl.formatMessage({ id: 'transaction__history' }),
              },
            ]}
            renderScene={SceneMap({
              tokens: AssetsList,
              collectibles: Collectibles,
              history: HistoricalRecord,
            })}
          />
        </Box>
      </Box>
    </Box>
  );
};

export default Wallet;
