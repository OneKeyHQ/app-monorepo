import React, { useCallback, useMemo } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  IconButton,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { ReceiveTokenRoutes } from '@onekeyhq/kit/src/routes/Modal/routes';
import type { ReceiveTokenRoutesParams } from '@onekeyhq/kit/src/routes/Modal/types';
import {
  ModalRoutes,
  ModalScreenProps,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import extUtils from '../../../utils/extUtils';

type NavigationProps = ModalScreenProps<ReceiveTokenRoutesParams>;

export const FIXED_VERTICAL_HEADER_HEIGHT = 222;
export const FIXED_HORIZONTAL_HEDER_HEIGHT = 190;

const AccountInfo = () => {
  const intl = useIntl();
  const isSmallView = useIsVerticalLayout();
  const navigation = useNavigation<NavigationProps['navigation']>();

  const renderAccountAmountInfo = useCallback(
    (isCenter: boolean) => (
      <Box alignItems={isCenter ? 'center' : 'flex-start'}>
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
      <Box flexDirection="row" justifyContent="center" alignItems="center">
        <Button
          size={isSmallView ? 'lg' : 'base'}
          leftIconName="ArrowUpSolid"
          minW={{ base: '126px', md: 'auto' }}
          type="basic"
          onPress={() => {
            // navigation.navigate(ModalNavigatorRoutes.SendNavigator, {
            //   screen: ModalRoutes.Send,
            // });
          }}
        >
          {intl.formatMessage({ id: 'action__send' })}
        </Button>
        <Button
          size={isSmallView ? 'lg' : 'base'}
          ml={4}
          leftIconName="ArrowDownSolid"
          minW={{ base: '126px', md: 'auto' }}
          type="basic"
          onPress={() => {
            navigation.navigate(RootRoutes.Modal, {
              screen: ModalRoutes.Receive,
              params: {
                screen: ReceiveTokenRoutes.ReceiveToken,
                params: {
                  address: 'xx',
                },
              },
            });
          }}
        >
          {intl.formatMessage({ id: 'action__receive' })}
        </Button>
        {platformEnv.isExtensionUiPopup && (
          <IconButton
            onPress={() => {
              extUtils.openExpandTab({ route: '' });
            }}
            ml={4}
            name="ArrowsExpandOutline"
          />
        )}
      </Box>
    ),
    [intl, isSmallView, navigation],
  );

  return useMemo(() => {
    if (isSmallView) {
      return (
        <Box
          py={8}
          w="100%"
          px={4}
          flexDirection="column"
          bgColor="background-default"
          h={FIXED_VERTICAL_HEADER_HEIGHT}
        >
          {renderAccountAmountInfo(true)}
          <Box mt={8}>{accountOption}</Box>
        </Box>
      );
    }
    return (
      <Box
        h={FIXED_HORIZONTAL_HEDER_HEIGHT}
        py={12}
        px={4}
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
