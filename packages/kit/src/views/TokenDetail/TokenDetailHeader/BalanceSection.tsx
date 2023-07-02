import type { FC } from 'react';
import { useContext } from 'react';

import B from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Typography } from '@onekeyhq/components';

import {
  FormatBalance,
  FormatCurrencyNumber,
} from '../../../components/Format';
import { useTokenPositionInfo } from '../../../hooks';
import { TokenDetailContext } from '../context';

export const BalanceSection: FC = () => {
  const intl = useIntl();

  const context = useContext(TokenDetailContext);
  const {
    walletId,
    accountId,
    networkId,
    tokenAddress,
    coingeckoId,
    symbol,
    price,
  } = context?.routeParams ?? {};
  const positionInfo = useTokenPositionInfo({
    walletId: walletId ?? '',
    networkId: networkId ?? '',
    accountId: accountId ?? '',
    tokenAddress: tokenAddress ?? '',
    coingeckoId,
  });

  return (
    <>
      <Typography.Heading>
        {intl.formatMessage({ id: 'content__balance' })}
      </Typography.Heading>
      <FormatBalance
        balance={positionInfo.balance ?? 0}
        suffix={symbol}
        formatOptions={{
          fixed: 6,
        }}
        render={(ele) => (
          <Typography.DisplayXLarge>{ele}</Typography.DisplayXLarge>
        )}
      />

      <Typography.Body2 mt="4px" color="text-subdued">
        <FormatCurrencyNumber
          value={new B(positionInfo?.balance ?? 0).times(price ?? 0)}
        />
      </Typography.Body2>
    </>
  );
};
