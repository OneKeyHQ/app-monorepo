import React, { FC, useCallback, useState } from 'react';

import { pick } from 'lodash';
import { FormattedNumber } from 'react-intl';

import { Box, IconButton, Spinner, Text, Token } from '@onekeyhq/components';
import { PriceAlertItem } from '@onekeyhq/engine/src/managers/notification';
import { Token as TokenType } from '@onekeyhq/engine/src/types/token';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { formatDecimalZero, getFiatCodeUnit } from '../Market/utils';

export function FormatCurrencyNumber({
  value,
  onlyNumber,
  currency,
}: {
  value: number;
  onlyNumber?: boolean;
  currency: string;
}) {
  if (typeof value !== 'number') {
    return null;
  }
  return currency === 'btc' ? (
    <>{`${!onlyNumber ? getFiatCodeUnit('btc') : ''}${formatDecimalZero(
      value,
    )}`}</>
  ) : (
    <FormattedNumber
      value={value}
      currencyDisplay="narrowSymbol"
      style={onlyNumber ? 'decimal' : 'currency'}
      minimumFractionDigits={2}
      maximumFractionDigits={10}
      currency={currency}
    />
  );
}

const PriceItem: FC<{
  divider: boolean;
  onRemove: (price: string) => void;
  alert: PriceAlertItem;
  token: TokenType;
}> = ({ divider, token, alert, ...props }) => {
  const { price, currency } = alert;
  const [loading, setLoading] = useState(false);

  const onRemove = useCallback(async () => {
    setLoading(true);
    try {
      await backgroundApiProxy.serviceNotification.removePriceAlertConfig(
        pick(alert, 'impl', 'chainId', 'price', 'currency', 'address'),
      );
    } catch (error) {
      debugLogger.common.error(
        `remove PriceAlert`,
        error instanceof Error ? error?.message : error,
      );
    }
    setTimeout(() => {
      setLoading(false);
      props?.onRemove(alert.price);
    }, 200);
  }, [props, alert]);

  return (
    <Box
      display="flex"
      flexDirection="row"
      justifyContent="space-between"
      alignItems="center"
      py={4}
      px={{ base: 4, md: 6 }}
      borderBottomWidth={divider ? '1 ' : undefined}
      borderBottomColor="divider"
      borderBottomRadius={divider ? undefined : '12px'}
    >
      <Box flex="1" flexDirection="row" alignItems="center">
        <Token size={8} token={token} showNetworkIcon />
        <Text typography="Body1Strong" numberOfLines={1} ml={3} flex="1">
          {`1 ${token.symbol} = `}
          <FormatCurrencyNumber value={+(price || 0)} currency={currency} />
        </Text>
        <Box w="8" h="8" alignItems="center" justifyContent="center">
          {loading ? (
            <Spinner size="sm" />
          ) : (
            <IconButton
              name="TrashMini"
              type="plain"
              circle
              onPress={onRemove}
            />
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default PriceItem;
