import { useCallback, useLayoutEffect } from 'react';

import { useIntl } from 'react-intl';

import { Box, ScrollView, useTheme } from '@onekeyhq/components';
import type { PriceAlertItem } from '@onekeyhq/engine/src/managers/notification';
import { useNavigation } from '@onekeyhq/kit/src/hooks';

import { ListEmptyComponent } from './Empty';
import { usePriceAlertlist } from './hooks';
import PriceItem from './PriceItem';

const Section = ({
  alerts,
  onRemove,
}: {
  alerts: PriceAlertItem[];
  onRemove: (item?: PriceAlertItem) => void;
}) => {
  const { length } = alerts;
  const { themeVariant } = useTheme();

  const handleRemove = useCallback(
    (price: string) => {
      onRemove?.(alerts.find((a) => a.price === price));
    },
    [onRemove, alerts],
  );

  return (
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
          key={`${a.price}-${a.currency}`}
          divider={index !== length - 1}
          onRemove={handleRemove}
        />
      ))}
    </Box>
  );
};

const NotificationPriceAlert = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const { alerts, loading, fetchPriceAlerts } = usePriceAlertlist();

  useLayoutEffect(() => {
    const title = intl.formatMessage({ id: 'title__manage_price_alert' });
    navigation.setOptions({
      title,
    });
  }, [navigation, intl]);

  if (!alerts.length) {
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
      <Section alerts={alerts} onRemove={fetchPriceAlerts} />
    </ScrollView>
  );
};

export default NotificationPriceAlert;
