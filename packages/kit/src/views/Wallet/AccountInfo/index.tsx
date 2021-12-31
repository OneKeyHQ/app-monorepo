import React, { useCallback, useMemo } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Icon,
  Typography,
  useUserDevice,
} from '@onekeyhq/components';
import {
  ReceiveQRCodeModalRoutes,
  ReceiveQRCodeRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/ReceiveToken';
import {
  SendTokenModalRoutes,
  SendTokenRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/SendToken';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  SendTokenRoutesParams,
  SendTokenModalRoutes.SendTokenModal
> &
  NativeStackNavigationProp<
    ReceiveQRCodeRoutesParams,
    ReceiveQRCodeModalRoutes.ReceiveQRCodeModal
  >;

const AccountInfo = () => {
  const isSmallView = ['SMALL', 'NORMAL'].includes(useUserDevice().size);
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();

  const renderAccountAmountInfo = useCallback(
    (isCenter: boolean) => (
      <Box alignItems={isCenter ? 'center' : 'flex-start'} mt={8}>
        <Typography.Subheading color="text-subdued">
          {intl.formatMessage({ id: 'asset__total_balance' }).toUpperCase()}
        </Typography.Subheading>
        <Box flexDirection="row" mt={2}>
          <Typography.DisplayXLarge>10.100</Typography.DisplayXLarge>
          <Typography.DisplayXLarge pl={2}>ETH</Typography.DisplayXLarge>
        </Box>
        <Typography.Body2 mt={1}>43123.12 USD</Typography.Body2>
      </Box>
    ),
    [intl],
  );

  const accountOption = useMemo(
    () => (
      <Box flexDirection="row" mt={8} justifyContent="center">
        <Button
          leftIcon={<Icon size={20} name="ArrowSmUpSolid" />}
          minW="126px"
          type="basic"
          onPress={() => {
            navigation.navigate(SendTokenModalRoutes.SendTokenModal);
          }}
        >
          {intl.formatMessage({ id: 'action__send' })}
        </Button>
        <Button
          ml={4}
          leftIcon={<Icon name="ArrowSmDownSolid" />}
          minW="126px"
          type="basic"
          onPress={() => {
            navigation.navigate(ReceiveQRCodeModalRoutes.ReceiveQRCodeModal);
          }}
        >
          {intl.formatMessage({ id: 'action__receive' })}
        </Button>
      </Box>
    ),
    [intl, navigation],
  );

  return useMemo(() => {
    if (isSmallView) {
      return (
        <Box w="100%" flexDirection="column" bgColor="background-default">
          {renderAccountAmountInfo(true)}
          {accountOption}
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
        bgColor="background-default"
      >
        <Box>{renderAccountAmountInfo(false)}</Box>
        <Box>{accountOption}</Box>
      </Box>
    );
  }, [isSmallView, renderAccountAmountInfo, accountOption]);
};

export default AccountInfo;
