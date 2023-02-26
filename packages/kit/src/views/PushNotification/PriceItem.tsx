import type { FC } from 'react';
import { useCallback, useState } from 'react';

import { pick } from 'lodash';
import { FormattedNumber } from 'react-intl';

import { Box, IconButton, Spinner, Text, Token } from '@onekeyhq/components';
import type { PriceAlertItem } from '@onekeyhq/engine/src/managers/notification';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { formatDecimalZero } from '../Market/utils';
import { useCurrencyUnit } from '../Me/GenaralSection/CurrencySelect/hooks';

export function FormatCurrencyNumber({
  value,
  onlyNumber,
  unit,
}: {
  value: number;
  onlyNumber?: boolean;
  unit: string;
}) {
  if (typeof value !== 'number') {
    return null;
  }
  return unit.toLowerCase() === 'sats' ? (
    <>
      {value < 0.01 ? (
        `${formatDecimalZero(value)}`
      ) : (
        <FormattedNumber
          value={value ?? 0}
          // currencyDisplay="narrowSymbol"
          // eslint-disable-next-line react/style-prop-object
          style="decimal"
          minimumFractionDigits={2}
          maximumFractionDigits={10}
          // currency={selectedFiatMoneySymbol}
        />
      )}
      {` ${!onlyNumber ? unit : ''}`}
    </>
  ) : (
    <>
      {`${!onlyNumber ? unit : ''}`}
      {value < 0.01 ? (
        `${formatDecimalZero(value)}`
      ) : (
        <FormattedNumber
          value={value ?? 0}
          // currencyDisplay="narrowSymbol"
          // eslint-disable-next-line react/style-prop-object
          style="decimal"
          minimumFractionDigits={2}
          maximumFractionDigits={10}
          // currency={selectedFiatMoneySymbol}
        />
      )}
    </>
  );
}

const PriceItem: FC<{
  divider: boolean;
  onRemove: (price: string) => void;
  alert: PriceAlertItem;
}> = ({ divider, alert, ...props }) => {
  const { price, currency } = alert;
  const unit = useCurrencyUnit(currency);
  const [loading, setLoading] = useState(false);

  const onRemove = useCallback(async () => {
    setLoading(true);
    try {
      await backgroundApiProxy.serviceNotification.removePriceAlertConfig(
        pick(alert, 'price', 'currency', 'coingeckoId'),
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
        <Token size={8} token={alert} showNetworkIcon />
        <Text typography="Body1Strong" numberOfLines={1} ml={3} flex="1">
          {`1 ${alert.symbol} = `}
          <FormatCurrencyNumber value={+(price || 0)} unit={unit} />
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
