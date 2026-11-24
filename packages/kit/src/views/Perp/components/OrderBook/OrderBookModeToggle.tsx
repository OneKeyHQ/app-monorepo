import { useIntl } from 'react-intl';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import type { IOrderBookDisplayMode } from './types';

const NEXT_MODE: Record<IOrderBookDisplayMode, IOrderBookDisplayMode> = {
  both: 'bids',
  bids: 'asks',
  asks: 'both',
};

const MODE_LABEL: Record<IOrderBookDisplayMode, ETranslations> = {
  both: ETranslations.global_all,
  bids: ETranslations.global_buy,
  asks: ETranslations.global_sell,
};

const styles = StyleSheet.create({
  button: { width: 24, height: 24, padding: 3, flexDirection: 'row', gap: 2 },
  column: { width: 8, height: 18, gap: 2 },
  bar: { flex: 1, borderRadius: 1 },
});

export function OrderBookModeToggle({
  mode,
  onChange,
}: {
  mode: IOrderBookDisplayMode;
  onChange: (mode: IOrderBookDisplayMode) => void;
}) {
  const intl = useIntl();
  const theme = useTheme();
  const modeLabel = intl.formatMessage({
    id: MODE_LABEL[mode],
  });
  const neutralStyle = { backgroundColor: theme.iconDisabled.val };
  const bidStyle = { backgroundColor: theme.bgAccent.val };
  const askStyle = { backgroundColor: theme.bgCriticalStrong.val };

  return (
    <Pressable
      testID="perp-orderbook-mode-toggle"
      accessibilityRole="button"
      accessibilityLabel={`${intl.formatMessage({ id: ETranslations.perps_order_book })}: ${modeLabel}`}
      hitSlop={8}
      onPress={() => onChange(NEXT_MODE[mode])}
      style={styles.button}
    >
      <View style={styles.column}>
        <View style={[styles.bar, neutralStyle]} />
        <View style={[styles.bar, neutralStyle]} />
        <View style={[styles.bar, neutralStyle]} />
      </View>
      <View style={styles.column}>
        {mode !== 'bids' ? <View style={[styles.bar, askStyle]} /> : null}
        {mode !== 'asks' ? <View style={[styles.bar, bidStyle]} /> : null}
      </View>
    </Pressable>
  );
}
