import { useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Alert, Box } from '@onekeyhq/components';

import { useAppSelector } from '../../../../hooks';
import { gt } from '../../utils';

export function PriceWarning() {
  const intl = useIntl();
  const tokenIn = useAppSelector((s) => s.limitOrder.tokenIn);
  const instantRate = useAppSelector((s) => s.limitOrder.instantRate);
  const mktRate = useAppSelector((s) => s.limitOrder.mktRate);

  const percent = useMemo(() => {
    if (instantRate && mktRate && instantRate !== mktRate) {
      const bn = new BigNumber(mktRate);
      const percentBN = bn
        .minus(instantRate)
        .absoluteValue()
        .div(mktRate)
        .multipliedBy(100);
      const text = percentBN.decimalPlaces(2).toFixed();
      return gt(text, 5) && gt(mktRate, instantRate) ? `${text}%` : '';
    }
    return '';
  }, [instantRate, mktRate]);

  if (percent) {
    return (
      <Box mb="4">
        <Alert
          title={intl.formatMessage(
            {
              id: 'msg__limit_price_is_str_lower_than_the_current_market_price',
            },
            { '0': percent },
          )}
          description={intl.formatMessage(
            {
              id: 'msg__limit_price_is_str_lower_than_the_current_market_price_desc',
            },
            { '0': tokenIn?.symbol.toUpperCase() ?? '' },
          )}
          alertType="warn"
          dismiss={false}
        />
      </Box>
    );
  }

  return null;
}
