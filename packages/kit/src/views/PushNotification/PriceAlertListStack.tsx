import React, { FC, useCallback, useLayoutEffect, useMemo } from 'react';

import { groupBy } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  Empty,
  ScrollView,
  Spinner,
  Text,
  useTheme,
} from '@onekeyhq/components';
import { PriceAlertItem } from '@onekeyhq/engine/src/managers/notification';
import imageUrl from '@onekeyhq/kit/assets/alert.png';
import { useNavigation } from '@onekeyhq/kit/src/hooks';

import { useSingleToken } from '../../hooks/useTokens';
import { HomeRoutes, HomeRoutesParams } from '../../routes/types';

import { usePriceAlertlist } from './hooks';
import PriceItem from './PriceItem';

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
          <PriceItem
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
  const { alerts, fetchPriceAlerts } = usePriceAlertlist();

  const data = useMemo(() => {
    const groupedData = groupBy(
      alerts,
      (item) => `${item.impl}--${item.chainId}--${item.address}`,
    );
    return Object.entries(groupedData);
  }, [alerts]);

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
        data.map(([tokenId, alertList]) => (
          <Section
            key={tokenId}
            alerts={alertList}
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
