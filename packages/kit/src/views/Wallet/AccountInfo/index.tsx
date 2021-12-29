import React, { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Icon,
  Typography,
  useUserDevice,
} from '@onekeyhq/components';

import ReceiveQRcode from '../../Transaction/receiveQRcode';
import Transaction from '../../Transaction/transaction';

const AccountInfo = () => {
  const { size: accountInfoSize } = useUserDevice();
  const intl = useIntl();

  const AccountAmountInfo = useCallback(
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

  const AccountOption = useCallback(
    () => (
      <Box flexDirection="row" mt={8} justifyContent="center">
        <Transaction
          trigger={
            <Button
              leftIcon={<Icon name="ArrowSmUpSolid" />}
              minW="126px"
              type="basic"
            >
              {intl.formatMessage({ id: 'action__send' })}
            </Button>
          }
        />
        <ReceiveQRcode
          trigger={
            <Button
              ml={4}
              leftIcon={<Icon name="ArrowSmDownSolid" />}
              minW="126px"
              type="basic"
            >
              {intl.formatMessage({ id: 'action__receive' })}
            </Button>
          }
        />
      </Box>
    ),
    [intl],
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
  }, [AccountAmountInfo, AccountOption, accountInfoSize]);
};

export default AccountInfo;
