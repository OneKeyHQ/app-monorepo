import type { FC } from 'react';
import { memo, useCallback, useContext, useRef } from 'react';

import { useFocusEffect } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Icon,
  Pressable,
  Typography,
  useSafeAreaInsets,
} from '@onekeyhq/components';

import { FormatCurrencyNumber } from '../../../components/Format';
import { showOverlay } from '../../../utils/overlayUtils';
import { calculateGains } from '../../../utils/priceUtils';
import { BottomSheetSettings } from '../../Overlay/BottomSheetSettings';
import { TokenDetailContext } from '../context';

import { ChartSection } from './ChartSection';

const VerticalPriceChartSection: FC = () => {
  const closeRef = useRef<() => void>(null);
  const intl = useIntl();
  const { bottom } = useSafeAreaInsets();
  const context = useContext(TokenDetailContext);
  const { price, price24h } = context?.routeParams ?? {};

  const { percentageGain, gainTextColor } = calculateGains({
    price,
    basePrice: new BigNumber(price ?? 0)
      .multipliedBy(1 - (price24h ?? 0) / 100)
      .toNumber(),
  });

  const showChart = useCallback(() => {
    if (!context?.routeParams) {
      return;
    }
    if (closeRef?.current) {
      closeRef?.current?.();
    }
    // @ts-ignore
    closeRef.current = showOverlay((closeOverlay) => (
      <BottomSheetSettings closeOverlay={closeOverlay}>
        <ChartSection {...context?.routeParams} />
      </BottomSheetSettings>
    ));
  }, [context?.routeParams]);

  useFocusEffect(
    useCallback(
      () => () => {
        closeRef?.current?.();
      },
      [],
    ),
  );

  if (!price || !price24h) {
    return null;
  }

  return (
    <Pressable
      pb={`${Math.max(bottom, 32)}px`}
      position="absolute"
      bottom="0"
      left="0"
      w="full"
      alignItems="center"
      display="flex"
      justifyContent="space-between"
      flexDirection="row"
      px="3"
      pt="2"
      borderTopRadius="12px"
      borderTopWidth="1px"
      borderTopColor="border-subdued"
      onPress={showChart}
    >
      <Typography.Body2Strong flex="1" display="flex">
        {intl.formatMessage({ id: 'form__current_price' })}
      </Typography.Body2Strong>

      <Typography.Body2 mx="1">
        <FormatCurrencyNumber value={0} convertValue={+(price || 0)} />
      </Typography.Body2>

      <Typography.Body2 color={gainTextColor}>
        {percentageGain}
      </Typography.Body2>
      <Icon name="ChevronUpMini" size={20} />
    </Pressable>
  );
};
export default memo(VerticalPriceChartSection);
