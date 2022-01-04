import React from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  HeaderTabViewContainer,
  SceneMap,
  Spinner,
  TabView,
  useUserDevice,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import AccountInfo from './AccountInfo';
import AssetsList from './AssetsList';
import Collectibles from './Collectibles';
import HistoricalRecord from './HistoricalRecords';
import { ScrollRoute } from './type';

const Wallet = () => {
  const { size } = useUserDevice();
  const intl = useIntl();

  const renderScene = SceneMap({
    tokens: AssetsList,
    collectibles: Collectibles,
    history: HistoricalRecord,
  });

  return React.useMemo(() => {
    // Index is required for passing into sub scrollable page
    const routes = [
      {
        key: 'tokens',
        title: intl.formatMessage({ id: 'asset__tokens' }),
        index: 0,
      },
      {
        key: 'collectibles',
        title: intl.formatMessage({ id: 'asset__collectibles' }),
        index: 1,
      },
      {
        key: 'history',
        title: intl.formatMessage({ id: 'transaction__history' }),
        index: 2,
      },
    ] as ScrollRoute[];

    if (platformEnv.isNative) {
      return (
        <HeaderTabViewContainer
          renderScrollHeader={AccountInfo}
          headerHeight={222}
          routes={routes}
          renderScene={renderScene}
          renderLazyPlaceholder={() => (
            <Center flex="1" height={120}>
              <Box margin="10px">
                <Spinner size="lg" />
              </Box>
            </Center>
          )}
          lazy
          enableSnap
        />
      );
    }

    return (
      <Box
        flex={1}
        alignItems="center"
        flexDirection="column"
        bg="background-default"
      >
        <Box flex={1} w="100%" flexDirection="column" maxW="1024px">
          <AccountInfo />
          <Box mt={8} flex={1}>
            <TabView
              paddingX={16}
              autoWidth={!['SMALL'].includes(size)}
              routes={routes}
              renderScene={renderScene}
            />
          </Box>
        </Box>
      </Box>
    );
  }, [intl, renderScene, size]);
};

export default Wallet;
