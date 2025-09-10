import { Fragment } from 'react';

import { ScrollView, StyleSheet } from 'react-native';

import type { IAggregationBtn } from './types';

interface IAggregationControlsProps {
  aggregationBtn: IAggregationBtn;
  tickSize: number;
  tickSizes: number[];
  onChange: (nextTickSize: number) => void;
}

const controlHeight = 50;

const styles = StyleSheet.create({
  container: {
    height: controlHeight,
    flexShrink: 0,
    flexGrow: 0,
    borderBottomWidth: 1,
  },
  contentContainer: {
    height: controlHeight,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexDirection: 'row',
    marginRight: 8,
  },
});

export function AggregationControls({
  aggregationBtn,
  tickSizes,
  tickSize,
  onChange,
}: IAggregationControlsProps) {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      {tickSizes.map((size) => (
        <Fragment key={size}>
          {aggregationBtn(tickSize, size, onChange)}
        </Fragment>
      ))}
    </ScrollView>
  );
}
