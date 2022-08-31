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
import { useNavigation, useNetworkTokens } from '@onekeyhq/kit/src/hooks';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { HomeRoutes, HomeRoutesParams } from '../../routes/types';
import { getSuggestedDecimals } from '../../utils/priceUtils';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

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
  price: string;
  divider: boolean;
  currency: string;
  onRemove: (price: string) => void;
  token: TokenType;
}> = ({ divider, token, price, currency, ...props }) => {
  const [loading, setLoading] = useState(false);

  const onRemove = useCallback(async () => {
    setLoading(true);
    try {
      await backgroundApiProxy.engine.removePriceAlertConfig({
        price,
        currency,
        ...pick(token as Required<TokenType>, 'impl', 'chainId', 'address'),
      });
    } catch (error) {
      debugLogger.common.error(
        `remove PriceAlert`,
        error instanceof Error ? error?.message : error,
      );
    }
    setTimeout(() => {
      setLoading(false);
      props?.onRemove(price);
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
  tokenId,
  alerts,
  onRemove,
}: {
  tokenId: string;
  alerts: PriceAlertItem[];
  onRemove: (item?: PriceAlertItem) => void;
}) => {
  const { length } = alerts;
  const { themeVariant } = useTheme();

  const networkId = `${alerts[0].impl}--${alerts[0].chainId}`;
  const allTokens: TokenType[] = useNetworkTokens(networkId);

  const token = useMemo(
    () => allTokens.find((t) => t.id === tokenId),
    [allTokens, tokenId],
  );

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
            token={token}
            key={`${a.price}-${a.currency}`}
            price={a.price}
            divider={index !== length - 1}
            currency={a.currency || 'usd'}
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
  const [data, setData] = useState<[string, PriceAlertItem[]][]>([]);

  const fetchData = useCallback(async () => {
    try {
      const res = await backgroundApiProxy.engine.queryPriceAlertList();
      const groupedData = groupBy(
        res,
        (item) => `${item.impl}--${item.chainId}--${item.address}`,
      );
      setData(Object.entries(groupedData));
    } catch (error) {
      debugLogger.common.error(
        `queryPriceAlertList failed`,
        error instanceof Error ? error?.message : error,
      );
    }
  }, []);

  useLayoutEffect(() => {
    const title = intl.formatMessage({ id: 'title__manage_price_alert' });
    navigation.setOptions({
      title,
    });
    fetchData();
  }, [navigation, intl, fetchData]);

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
            tokenId={tokenId}
            alerts={alerts}
            onRemove={() => fetchData()}
          />
        ))
      ) : (
        <ListEmptyComponent isLoading={false} symbol="token" />
      )}
    </ScrollView>
  );
};

export default NotificationPriceAlert;
