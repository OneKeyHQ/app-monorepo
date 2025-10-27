import { StyleSheet, Text, TouchableOpacity } from 'react-native';

import type { IAggregationBtn } from './types';

const styles = StyleSheet.create({
  btn: {
    borderRadius: 100,
    padding: 4,
    marginLeft: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
    width: 34,
    height: 34,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSelected: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  btnLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontWeight: '600',
  },
  btnLabelSelected: {
    color: 'rgba(255,255,255,0.7)',
    fontWeight: 'bold',
  },
});

export const defaultAggregationBtn: IAggregationBtn = (
  selectedTickSize,
  tickSize,
  onChange,
) => (
  <TouchableOpacity
    disabled={tickSize === selectedTickSize}
    onPress={() => onChange(tickSize)}
    style={[styles.btn, tickSize === selectedTickSize && styles.btnSelected]}
  >
    <Text
      style={[
        styles.btnLabel,
        tickSize === selectedTickSize && styles.btnLabelSelected,
      ]}
    >
      {tickSize < 0.1 ? String(tickSize).substring(1) : tickSize}
    </Text>
  </TouchableOpacity>
);
