import type { FC } from 'react';
import { useContext } from 'react';

import B from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Box, Typography } from '@onekeyhq/components';
import { freezedEmptyObject } from '@onekeyhq/shared/src/consts/sharedConsts';

import {
  FormatBalance,
  FormatCurrencyNumber,
} from '../../../components/Format';
import { TokenDetailContext } from '../context';

import type { ITokenDetailContext } from '../context';

export const BalanceSection: FC = () => {
  const intl = useIntl();

  const context = useContext(TokenDetailContext);
  const { balance, detailInfo } =
    context ?? (freezedEmptyObject as ITokenDetailContext);

  return (
    <Box>
      <Typography.Heading>
        {intl.formatMessage({ id: 'content__balance' })}
      </Typography.Heading>
      <FormatBalance
        balance={balance ?? 0}
        suffix={detailInfo?.symbol}
        formatOptions={{
          fixed: 6,
        }}
        render={(ele) => (
          <Typography.DisplayXLarge>{ele}</Typography.DisplayXLarge>
        )}
      />

      <Typography.Body2 mt="4px" color="text-subdued">
        <FormatCurrencyNumber
          value={0}
          convertValue={new B(balance ?? 0).times(detailInfo.price ?? 0)}
        />
      </Typography.Body2>
    </Box>
  );
};
