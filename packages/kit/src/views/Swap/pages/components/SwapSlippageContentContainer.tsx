import { memo, useCallback, useState } from 'react';

import { BigNumber } from 'bignumber.js';
import { debounce } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Input,
  SegmentControl,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useSwapSlippagePercentageAtom } from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import {
  swapSlippageAutoValue,
  swapSlippageItems,
  swapSlippageMaxValue,
  swapSlippageWillAheadMinValue,
  swapSlippageWillFailMinValue,
} from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import {
  ESwapSlippageCustomStatus,
  ESwapSlippageSegmentKey,
} from '@onekeyhq/shared/types/swap/types';

import { validateAmountInput } from '../../utils/utils';

const SwapsSlippageContentContainer = () => {
  const [inputValue, setInputValue] = useState('');
  const [swapSlippage, setSwapSlippage] = useSwapSlippagePercentageAtom();
  const intl = useIntl();

  const [customValueState, setCustomValueState] = useState<{
    status: ESwapSlippageCustomStatus;
    message: string;
  }>({ status: ESwapSlippageCustomStatus.NORMAL, message: '' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleSlippageChange = useCallback(
    debounce((value: string) => {
      const valueBN = new BigNumber(value);
      if (
        valueBN.isNaN() ||
        valueBN.isNegative() ||
        valueBN.gt(swapSlippageMaxValue)
      ) {
        setCustomValueState({
          status: ESwapSlippageCustomStatus.ERROR,
          message: 'Slippage Tolerance must be between 0 to 50%.',
        });
        return;
      }
      if (valueBN.lte(swapSlippageWillFailMinValue)) {
        setCustomValueState({
          status: ESwapSlippageCustomStatus.WRONG,
          message: 'Your trade may fail due to small slippage.',
        });
      }
      if (valueBN.gte(swapSlippageWillAheadMinValue)) {
        setCustomValueState({
          status: ESwapSlippageCustomStatus.WRONG,
          message:
            'Your transaction may be frontrun and result in an unfavorable trade.',
        });
      }
      setSwapSlippage({
        key: ESwapSlippageSegmentKey.CUSTOM,
        value: valueBN.toNumber(),
      });
    }, 200),
    [],
  );

  return (
    <YStack p="$4" space="$4">
      <XStack flex={1} space="$4">
        <XStack w={167}>
          <SegmentControl
            fullWidth
            value={swapSlippage.key}
            options={swapSlippageItems.map((item) => ({
              label: intl.formatMessage({
                id:
                  item.key === ESwapSlippageSegmentKey.AUTO
                    ? 'form__auto'
                    : 'content__custom',
              }),
              value: item.value,
            }))}
            onChange={(value) => {
              const keyValue = value as ESwapSlippageSegmentKey;
              setSwapSlippage({
                key: keyValue,
                value: swapSlippageAutoValue,
              });
            }}
          />
        </XStack>

        <Input
          w={120}
          value={inputValue}
          autoFocus={swapSlippage.key === ESwapSlippageSegmentKey.CUSTOM}
          addOns={[{ label: '%' }]}
          textAlign="right"
          disabled={swapSlippage.key === ESwapSlippageSegmentKey.AUTO}
          placeholder={swapSlippage.value.toString()}
          onChangeText={(text) => {
            if (validateAmountInput(text)) {
              setInputValue(text);
              handleSlippageChange(text);
            }
          }}
        />
      </XStack>
      {swapSlippage.key !== ESwapSlippageSegmentKey.AUTO &&
      customValueState.status !== ESwapSlippageCustomStatus.NORMAL ? (
        <SizableText
          color={
            customValueState.status === ESwapSlippageCustomStatus.ERROR
              ? 'text/critical'
              : 'text/caution'
          }
        >
          {customValueState.message}
        </SizableText>
      ) : null}
    </YStack>
  );
};

export default memo(SwapsSlippageContentContainer);
