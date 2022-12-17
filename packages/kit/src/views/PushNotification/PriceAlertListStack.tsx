import { useCallback, useLayoutEffect, useMemo } from 'react';

import { groupBy } from 'lodash';
import { useIntl } from 'react-intl';

import { Box, ScrollView, Text, useTheme } from '@onekeyhq/components';
import type { PriceAlertItem } from '@onekeyhq/engine/src/managers/notification';
import { useNavigation } from '@onekeyhq/kit/src/hooks';

import { useSingleToken } from '../../hooks/useTokens';

import { ListEmptyComponent } from './Empty';
import { usePriceAlertlist } from './hooks';
import PriceItem from './PriceItem';

import type { HomeRoutes, HomeRoutesParams } from '../../routes/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  HomeRoutesParams,
  HomeRoutes.SettingsWebviewScreen
>;

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
  const { alerts, loading, fetchPriceAlerts } = usePriceAlertlist();

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

  if (!data.length) {
    return <ListEmptyComponent isLoading={loading} symbol="token" />;
  }

  return (
    <ScrollView
      w="full"
      h="full"
      bg="background-default"
      p="4"
      maxW={768}
      mx="auto"
    >
      {data.map(([tokenId, alertList]) => (
        <Section key={tokenId} alerts={alertList} onRemove={fetchPriceAlerts} />
      ))}
    </ScrollView>
  );
};

export default NotificationPriceAlert;
