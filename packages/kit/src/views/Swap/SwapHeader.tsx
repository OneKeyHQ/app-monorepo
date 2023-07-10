import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  Box,
  Pressable,
  ToastManager,
  Typography,
} from '@onekeyhq/components';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../hooks';
import { setMode } from '../../store/reducers/swap';

import { limitOrderNetworkIds } from './config';
import { HistoryButton } from './HistoryButton';

export const SwapHeaderTab = () => {
  const intl = useIntl();
  const swapMode = useAppSelector((s) => s.swap.mode);
  const inputToken = useAppSelector((s) => s.swap.inputToken);
  const isSwap = swapMode === 'swap';

  const setLimitOrderMode = useCallback(() => {
    if (!inputToken || !limitOrderNetworkIds.includes(inputToken.networkId)) {
      ToastManager.show(
        {
          title: intl.formatMessage(
            {
              id: 'limit_orders_are_only_supported_for_str',
            },
            { '0': 'ETH, BSC, Polygon' },
          ),
        },
        { type: 'default' },
      );
    }
    backgroundApiProxy.serviceLimitOrder.setDefaultTokens();
    backgroundApiProxy.dispatch(setMode('limit'));
  }, [inputToken, intl]);

  return (
    <Box flexDirection="row" alignItems="center" h="30px">
      <Pressable
        mr="3"
        onPress={() => backgroundApiProxy.dispatch(setMode('swap'))}
      >
        <Typography.Body1Strong
          color={isSwap ? 'text-default' : 'text-disabled'}
        >
          {intl.formatMessage({ id: 'title__swap' })}
        </Typography.Body1Strong>
      </Pressable>
      <Pressable
        onPress={setLimitOrderMode}
        flexDirection="row"
        alignItems="center"
      >
        <Typography.Body1Strong
          color={!isSwap ? 'text-default' : 'text-disabled'}
        >
          {intl.formatMessage({ id: 'form__limit' })}
        </Typography.Body1Strong>
        <Box ml="1">
          <Badge type="info" size="sm" title="Beta" />
        </Box>
      </Pressable>
    </Box>
  );
};

export const SwapHeader = () => (
  <Box
    width="full"
    flexDirection="row"
    h="9"
    justifyContent="space-between"
    alignItems="center"
  >
    <SwapHeaderTab />
    <HistoryButton />
  </Box>
);
