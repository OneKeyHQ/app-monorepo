import React, { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import { Box, Button, Icon, Typography } from '@onekeyhq/components';
import { Body2UnderlineProps } from '@onekeyhq/components/src/Typography';

import { useInterval } from '../../../hooks';
import { useSwapQuoteCallback, useSwapState } from '../hooks/useSwap';

export const Timer = () => {
  const intl = useIntl();
  const { quoteTime } = useSwapState();
  const onSwapQuote = useSwapQuoteCallback();
  const [remainTime, setRemainTime] = useState<number>(() => {
    if (quoteTime) {
      const now = Date.now();
      const seconds = Math.max(
        Math.floor((+quoteTime + 15000 - now) / 1000),
        0,
      );
      return seconds;
    }
    return 15;
  });
  const onInterval = useCallback(() => {
    if (quoteTime) {
      const now = Date.now();
      const seconds = Math.max(Math.ceil((+quoteTime + 15000 - now) / 1000), 0);
      setRemainTime(seconds);
    }
  }, [quoteTime]);
  const onPress = useCallback(async () => {
    await onSwapQuote();
  }, [onSwapQuote]);
  useInterval(onInterval, 1000);
  return (
    <Box
      p="4"
      bg="surface-neutral-subdued"
      flexDirection="row"
      justifyContent="space-between"
      alignItems="center"
      borderRadius={12}
    >
      <Box flexDirection="row" alignItems="center">
        <Icon name="InformationCircleSolid" size={20} />
        <Typography.Body2 ml="2">
          {intl.formatMessage(
            { id: 'content__price_updates_after_str' },
            {
              '0': (
                <Typography.Body2 color="interactive-default">{` ${remainTime}s `}</Typography.Body2>
              ),
            },
          )}
        </Typography.Body2>
      </Box>
      <Button
        type="plain"
        size="sm"
        textProps={{ ...Body2UnderlineProps }}
        onPromise={onPress}
      >
        {intl.formatMessage({ id: 'action__refresh' })}
      </Button>
    </Box>
  );
};
