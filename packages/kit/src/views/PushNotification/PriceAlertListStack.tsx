import React, {
  FC,
  useCallback,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';

import { groupBy, pick } from 'lodash';
import { FormattedNumber, useIntl } from 'react-intl';

import {
  Box,
  Center,
  Empty,
  IconButton,
  ScrollView,
  Spinner,
  Text,
  Token,
  useTheme,
} from '@onekeyhq/components';
import { PriceAlertItem } from '@onekeyhq/engine/src/managers/notification';
import { Token as TokenType } from '@onekeyhq/engine/src/types/token';
import imageUrl from '@onekeyhq/kit/assets/alert.png';
import { useNavigation } from '@onekeyhq/kit/src/hooks';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { HomeRoutes, HomeRoutesParams } from '../../routes/types';
import { getSuggestedDecimals } from '../../utils/priceUtils';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { usePriceAlertlist, useSingleToken } from './hooks';

type ListEmptyComponentProps = {
  isLoading: boolean;
  symbol?: string;
};

type NavigationProps = NativeStackNavigationProp<
  HomeRoutesParams,
  HomeRoutes.SettingsWebviewScreen
>;

export const ListEmptyComponent: FC<ListEmptyComponentProps> = ({
  isLoading,
  symbol,
}) => {
  const intl = useIntl();
  if (isLoading) {
    return (
      <Center w="full" h="20">
        <Spinner size="lg" />
      </Center>
    );
  }
  return (
    <Empty
      imageUrl={imageUrl}
      title={intl.formatMessage({
        id: 'title__no_alert',
      })}
      subTitle={
        symbol
          ? intl.formatMessage(
              {
                id: 'title__no_alert_desc',
              },
              { 0: symbol },
            )
          : ''
      }
    />
  );
};
export function FormatCurrencyNumber({
  decimals,
  value,
  onlyNumber,
  currency,
}: {
  value: number;
  decimals?: number;
  onlyNumber?: boolean;
  currency: string;
}) {
  if (typeof value !== 'number') {
    return null;
  }
  const maxDecimals = decimals ?? getSuggestedDecimals(value);

  return (
    <FormattedNumber
      value={value}
      currencyDisplay="narrowSymbol"
      // eslint-disable-next-line react/style-prop-object
      style={onlyNumber ? 'decimal' : 'currency'}
      minimumFractionDigits={2}
      maximumFractionDigits={maxDecimals}
      currency={currency}
    />
  );
}

export const Item: FC<{
  divider: boolean;
  onRemove: (price: string) => void;
  alert: PriceAlertItem,
  token: TokenType;
}> = ({ divider, token, alert, ...props }) => {
  const {price,currency} = alert;
  const [loading, setLoading] = useState(false);

  const onRemove = useCallback(async () => {
    setLoading(true);
    try {
      await backgroundApiProxy.engine.removePriceAlertConfig(
        pick(alert, 'impl', 'chainId', 'price', 'currency', 'address')
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
  }, [price, props, token, currency]);

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
        <Token src={token.logoURI} size={8} />
        <Text typography="Body1Strong" numberOfLines={1} ml={3}>
          {`1 ${token.symbol} = `}
          <FormatCurrencyNumber value={+(price || 0)} currency={currency} />
        </Text>
      </Box>
      <Box w="8" h="8" alignItems="center" justifyContent="center">
        {loading ? (
          <Spinner size="sm" />
        ) : (
          <IconButton
            name="TrashSolid"
            type="plain"
            circle
            onPress={onRemove}
          />
        )}
      </Box>
    </Box>
  );
};

const Section = ({
  alerts,
  onRemove,
}: {
  alerts: PriceAlertItem[];
  onRemove: (item?: PriceAlertItem) => void;
}) => {
  const { length } = alerts;
  const { themeVariant } = useTheme();

  const networkId = `${alerts[0].impl}--${alerts[0].chainId}`;

  const token = useSingleToken(networkId, alerts[0].address);

  const handleRemove = useCallback(
    (price: string) => {
      onRemove?.(alerts.find((a) => a.price === price));
    },
    [onRemove, alerts],
  );

  if (!token) {
    return null;
  }

  return (
    <>
      <Text color="text-subdued">{token.symbol}</Text>
      <Box
        w="full"
        mt="2"
        mb={6}
        borderRadius="12"
        bg="surface-default"
        borderWidth={themeVariant === 'light' ? 1 : undefined}
        borderColor="border-subdued"
      >
        {alerts.map((a, index) => (
          <Item
            alert={a}
            token={token}
            key={`${a.price}-${a.currency}`}
            divider={index !== length - 1}
            onRemove={handleRemove}
          />
        ))}
      </Box>
    </>
  );
};

const NotificationPriceAlert = () => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();
  const {
    alerts, 
    fetchPriceAlerts
  } = usePriceAlertlist();

  const data = useMemo(() => {
    const groupedData = groupBy(
      alerts,
      (item) => `${item.impl}--${item.chainId}--${item.address}`,
    );
    return Object.entries(groupedData);
  }, [alerts])

  useLayoutEffect(() => {
    const title = intl.formatMessage({ id: 'title__manage_price_alert' });
    navigation.setOptions({
      title,
    });
  }, [navigation, intl]);

  return (
    <ScrollView
      w="full"
      h="full"
      bg="background-default"
      p="4"
      maxW={768}
      mx="auto"
    >
      {data.length > 0 ? (
        data.map(([tokenId, alerts]) => (
          <Section
            key={tokenId}
            alerts={alerts}
            onRemove={fetchPriceAlerts}
          />
        ))
      ) : (
        <ListEmptyComponent isLoading={false} symbol="token" />
      )}
    </ScrollView>
  );
};

export default NotificationPriceAlert;
