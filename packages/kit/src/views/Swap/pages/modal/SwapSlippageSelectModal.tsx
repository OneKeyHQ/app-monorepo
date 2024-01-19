import { useCallback, useMemo, useState } from 'react';

import type { IPageNavigationProp } from '@onekeyhq/components';
import {
  Button,
  Input,
  Page,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useSwapSlippagePercentageAtom } from '@onekeyhq/kit/src/states/jotai/contexts/swap';

import SwapSlippageSegmentGroup from '../../components/SwapSlippageSegmentGroup';
import {
  ESwapSlippageSegmentKey,
  type ISwapSlippageSegmentItem,
} from '../../types';
import { validateInput } from '../../utils/utils';
import { withSwapProvider } from '../WithSwapProvider';

import type { IModalSwapParamList } from '../../router/Routers';

const SwapSlippageSelectModal = () => {
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();

  const [swapUsedSlippagePercentage, setSwapUsedSlippagePercentage] =
    useSwapSlippagePercentageAtom();
  const [selectSlippage, setSelectSlippage] = useState<
    ISwapSlippageSegmentItem | undefined
  >();

  const [customSlippagePercentage, setCustomSlippagePercentage] =
    useState<string>('');

  const detailLabel = useMemo(() => {
    switch (selectSlippage?.key) {
      case ESwapSlippageSegmentKey.AUTO:
        return 'Auto.......';
      case ESwapSlippageSegmentKey.ZERO_ONE:
        return '0.1%........';
      case ESwapSlippageSegmentKey.ZERO_FIVE:
        return '0.5%.......';
      case ESwapSlippageSegmentKey.ONE:
        return '1%.......';
      case ESwapSlippageSegmentKey.CUSTOM:
        return '';
      default:
        return '';
    }
  }, [selectSlippage]);

  const canSave = useMemo(() => {
    if (!selectSlippage && !customSlippagePercentage) {
      return false;
    }
    if (selectSlippage) {
      return selectSlippage.key !== swapUsedSlippagePercentage.key;
    }
    if (customSlippagePercentage) {
      if (swapUsedSlippagePercentage.key === ESwapSlippageSegmentKey.CUSTOM) {
        return (
          swapUsedSlippagePercentage.value !== Number(customSlippagePercentage)
        );
      }
      return true;
    }
  }, [
    customSlippagePercentage,
    selectSlippage,
    swapUsedSlippagePercentage.key,
    swapUsedSlippagePercentage.value,
  ]);
  const onSave = useCallback(() => {
    if (customSlippagePercentage) {
      setSwapUsedSlippagePercentage({
        key: ESwapSlippageSegmentKey.CUSTOM,
        value: Number(customSlippagePercentage),
      });
    } else if (selectSlippage) {
      setSwapUsedSlippagePercentage(selectSlippage);
    }
    navigation.pop();
  }, [
    customSlippagePercentage,
    navigation,
    selectSlippage,
    setSwapUsedSlippagePercentage,
  ]);

  return (
    <Page>
      <YStack space="$4">
        <SwapSlippageSegmentGroup
          onSelectSlippage={(slippage) => {
            setCustomSlippagePercentage('');
            setSelectSlippage(slippage);
          }}
          currentUsedSlippageItem={swapUsedSlippagePercentage}
        />
        {detailLabel && <SizableText>{detailLabel}</SizableText>}
        <XStack justifyContent="center" alignItems="center">
          <SizableText>Or</SizableText>
        </XStack>
        <YStack>
          <SizableText>Custom Amount</SizableText>
          <Input
            value={customSlippagePercentage}
            placeholder={
              swapUsedSlippagePercentage.key === ESwapSlippageSegmentKey.CUSTOM
                ? `${swapUsedSlippagePercentage.value}`
                : ''
            }
            onFocus={() => {
              console.log('onFocus');
              setSelectSlippage(undefined);
            }}
            onChangeText={(text) => {
              if (validateInput(text)) {
                const number = Number(text);
                if (number >= 0 && number < 50)
                  setCustomSlippagePercentage(text);
              }
            }}
          />
        </YStack>
        <SizableText>What is slippage?</SizableText>
        <SizableText>
          Slippage refers to the maximum percentage of funds that you are
          willing to lose when making a trade. Increasing this percentage can
          increase the likelihood of executing the trade, but it also increases
          the potential loss of assets.
        </SizableText>
      </YStack>
      <Button disabled={!canSave} onPress={onSave}>
        Save
      </Button>
    </Page>
  );
};

export default withSwapProvider(SwapSlippageSelectModal);
