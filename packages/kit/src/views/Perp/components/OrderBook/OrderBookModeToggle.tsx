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

function OrderBookModeButton({
  mode,
  onPress,
  selected,
}: {
  mode: IOrderBookDisplayMode;
  onPress: () => void;
  selected?: boolean;
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
      testID={
        selected === undefined
          ? 'perp-orderbook-mode-toggle'
          : `perp-orderbook-mode-${mode}`
      }
      accessibilityRole="button"
      accessibilityLabel={`${intl.formatMessage({ id: ETranslations.perps_order_book })}: ${modeLabel}`}
      accessibilityState={selected === undefined ? undefined : { selected }}
      hitSlop={selected === undefined ? 8 : undefined}
      onPress={onPress}
      style={[styles.button, { opacity: selected === false ? 0.45 : 1 }]}
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

export function OrderBookModeToggle({
  mode,
  onChange,
}: {
  mode: IOrderBookDisplayMode;
  onChange: (mode: IOrderBookDisplayMode) => void;
}) {
  return (
    <OrderBookModeButton
      mode={mode}
      onPress={() => onChange(NEXT_MODE[mode])}
    />
  );
}

export const ORDER_BOOK_MODE_SELECTOR_HEIGHT = 40;
const DISPLAY_MODES: IOrderBookDisplayMode[] = ['both', 'bids', 'asks'];

export function OrderBookModeSelector({
  mode,
  onChange,
}: {
  mode: IOrderBookDisplayMode;
  onChange: (mode: IOrderBookDisplayMode) => void;
}) {
  return (
    <View
      style={{
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
        gap: 8,
      }}
    >
      {DISPLAY_MODES.map((item) => (
        <OrderBookModeButton
          key={item}
          mode={item}
          selected={mode === item}
          onPress={() => onChange(item)}
        />
      ))}
    </View>
  );
}
