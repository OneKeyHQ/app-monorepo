import React, { useEffect, useMemo, useState } from 'react';

import {
  Box,
  Button,
  Icon,
  SceneMap,
  TabView,
  Typography,
  useUserDevice,
} from '@onekeyhq/components';

import AssetsList from './AccountList';
import HistoricalRecord from './HistoricalRecords';

const Wallet = () => {
  type TabViewRoute = {
    key: string;
    title: string;
  };
  type TabViewScene = {
    [key: string]: React.ComponentType;
  };
  const { size } = useUserDevice();
  const [tabViewScene, setTabViewScene] = useState<TabViewScene>({
    tokens: AssetsList,
  });
  const [tabViewRoutes, setTabViewRoutes] = useState<TabViewRoute[]>([
    {
      key: 'tokens',
      title: 'Tokens',
    },
  ]);

  useEffect(() => {
    setTabViewScene({
      tokens: AssetsList,
      history: HistoricalRecord,
    });
    setTabViewRoutes([
      {
        key: 'tokens',
        title: 'Tokens',
      },
      {
        key: 'history',
        title: 'History',
      },
    ]);
  }, []);

  const AccountInfo = () => {
    const { size: accountInfoSize } = useUserDevice();

    const AccountAmountInfo = (isCenter: boolean) => (
      <Box alignItems={isCenter ? 'center' : 'flex-start'} mt={8}>
        <Typography.Subheading>TOTAL VALANCE</Typography.Subheading>
        <Box flexDirection="row" mt={2}>
          <Typography.DisplayXLarge>10.100</Typography.DisplayXLarge>
          <Typography.DisplayXLarge>ETH</Typography.DisplayXLarge>
        </Box>
        <Typography.Body2 mt={1}>43123.12 USD</Typography.Body2>
      </Box>
    );

    const AccountOption = () => (
      <Box flexDirection="row" mt={8} justifyContent="center">
        <Button
          leftIcon={<Icon name="ArrowSmUpOutline" />}
          minW="126px"
          type="basic"
        >
          Send
        </Button>
        <Button
          ml={4}
          leftIcon={<Icon name="ArrowSmDownOutline" />}
          minW="126px"
          type="basic"
        >
          Receive
        </Button>
      </Box>
    );

    return useMemo(() => {
      if (['SMALL', 'NORMAL'].includes(accountInfoSize)) {
        return (
          <Box w="100%" flexDirection="column">
            {AccountAmountInfo(true)}
            {AccountOption()}
          </Box>
        );
      }
      return (
        <Box
          pl={4}
          pr={4}
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Box>{AccountAmountInfo(false)}</Box>
          <Box>{AccountOption()}</Box>
        </Box>
      );
    }, [accountInfoSize]);
  };

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
            routes={tabViewRoutes}
            renderScene={SceneMap(tabViewScene)}
          />
        </Box>
      </Box>
    </Box>
  );
};

export default Wallet;
