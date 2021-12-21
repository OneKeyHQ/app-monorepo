import React, { useMemo } from 'react';

import {
  Box,
  Button,
  Icon,
  Typography,
  useUserDevice,
} from '@onekeyhq/components';

import AssetsList from './AccountList';
import HistoricalRecord from './HistoricalRecords';

const Wallet = () => {
  const AccountInfo = () => {
    const { size } = useUserDevice();

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
      if (['SMALL', 'NORMAL'].includes(size)) {
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
    }, [size]);
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
        {AssetsList()}
        {HistoricalRecord()}
      </Box>
    </Box>
  );
};

export default Wallet;
