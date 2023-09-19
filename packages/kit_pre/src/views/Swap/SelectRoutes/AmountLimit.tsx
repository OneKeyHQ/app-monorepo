import type { FC, ReactElement } from 'react';

import { useIntl } from 'react-intl';

import { Box, Divider, Typography } from '@onekeyhq/components';
import type { Token } from '@onekeyhq/engine/src/types/token';

import { useTokenAmount } from '../hooks/useSwap';

import type { FetchQuoteResponse } from '../typings';

type AmountLimitProps = {
  response?: FetchQuoteResponse;
  token?: Token;
};

export const AmountLimit: FC<AmountLimitProps> = ({ response, token }) => {
  const limited = response?.limited;
  const maxAmount = useTokenAmount(token, limited?.max);
  const minAmount = useTokenAmount(token, limited?.min);
  const intl = useIntl();
  let elem: ReactElement | undefined;

  if (!token) {
    return null;
  }
  if (limited && limited.max) {
    elem = (
      <Typography.Caption color="text-subdued">
        {intl.formatMessage({ id: 'form__max_amount' })} {maxAmount?.typedValue}
        {token?.symbol}
      </Typography.Caption>
    );
  } else if (limited && limited.min) {
    elem = (
      <Typography.Caption color="text-subdued">
        {intl.formatMessage({ id: 'form__min_amount' })}
        {minAmount?.typedValue}
        {token?.symbol}
      </Typography.Caption>
    );
  } else if (response?.data?.type === 'swftc') {
    elem = (
      <Typography.Caption color="text-subdued">
        {intl.formatMessage(
          { id: 'form__cap_str_day_rates_may_change_due_to_market' },
          { '0': '200,000 USDT' },
        )}
      </Typography.Caption>
    );
  }

  if (elem) {
    return (
      <Box>
        <Divider my="3" />
        {elem}
      </Box>
    );
  }

  return null;
};
