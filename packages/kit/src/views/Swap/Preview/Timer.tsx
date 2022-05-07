import React, { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import { Alert, Typography } from '@onekeyhq/components';

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
  useInterval(onInterval, 1000);
  return (
    <Alert
      alertType="info"
      title={intl.formatMessage(
        { id: 'content__price_updates_after_str' },
        {
          '0': (
            <Typography.Body2 color="interactive-default">{`${remainTime}s`}</Typography.Body2>
          ),
        },
      )}
      action={intl.formatMessage({ id: 'action__refresh' })}
      actionType="right"
      onAction={onSwapQuote}
      dismiss={false}
    />
  );
};
