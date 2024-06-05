import { memo, useCallback, useEffect, useState } from 'react';

import { BigNumber } from 'bignumber.js';
import { debounce } from 'lodash';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

import type { IInputProps } from '@onekeyhq/components';
import {
  Button,
  Dialog,
  Divider,
  Input,
  SegmentControl,
  SizableText,
  XStack,
  YStack,
  useMedia,
  useSafeKeyboardAnimationStyle,
} from '@onekeyhq/components';
import {
  swapSlippageCustomDefaultList,
  swapSlippageItems,
  swapSlippageMaxValue,
  swapSlippageWillAheadMinValue,
  swapSlippageWillFailMinValue,
} from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type { ISwapSlippageSegmentItem } from '@onekeyhq/shared/types/swap/types';
import {
  ESwapSlippageCustomStatus,
  ESwapSlippageSegmentKey,
} from '@onekeyhq/shared/types/swap/types';

import { validateAmountInput } from '../../utils/utils';

const BaseSlippageInput = ({
  swapSlippage,
  onChangeText,
}: {
  swapSlippage: ISwapSlippageSegmentItem;
  onChangeText: (text: string) => void;
}) => {
  const [inputValue, setInputValue] = useState('');
  const handleTextChange = useCallback(
    (text: string) => {
      if (validateAmountInput(text, 2)) {
        setInputValue(text);
        onChangeText(text);
      }
    },
    [onChangeText],
  );

  useEffect(() => {
    setInputValue(swapSlippage.value.toString());
  }, [swapSlippage.key, swapSlippage.value]);

  return (
    <Input
      $gtMd={
        {
          size: 'small',
        } as IInputProps['$gtMd']
      }
      value={inputValue}
      autoFocus={swapSlippage.key === ESwapSlippageSegmentKey.CUSTOM}
      addOns={[{ label: '%' }]}
      textAlign="right"
      disabled={swapSlippage.key === ESwapSlippageSegmentKey.AUTO}
      placeholder={swapSlippage.value.toString()}
      onChangeText={handleTextChange}
    />
  );
};

const SlippageInput = memo(BaseSlippageInput);

const SwapsSlippageContentContainer = ({
  swapSlippage,
  onSave,
}: {
  swapSlippage: ISwapSlippageSegmentItem;
  onSave: (slippage: ISwapSlippageSegmentItem) => void;
}) => {
  const [swapSlippageStatus, setSwapSlippageStatus] = useState(swapSlippage);
  const intl = useIntl();
  const media = useMedia();

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
      setSwapSlippageStatus({
        key: ESwapSlippageSegmentKey.CUSTOM,
        value: valueBN.toNumber(),
      });
      if (valueBN.lte(swapSlippageWillFailMinValue)) {
        setCustomValueState({
          status: ESwapSlippageCustomStatus.WRONG,
          message: 'Your trade may fail due to small slippage.',
        });
        return;
      }
      if (valueBN.gte(swapSlippageWillAheadMinValue)) {
        setCustomValueState({
          status: ESwapSlippageCustomStatus.WRONG,
          message: 'High slippage tolerance may cause your asset loss.',
        });
        return;
      }
      setCustomValueState({
        status: ESwapSlippageCustomStatus.NORMAL,
        message: '',
      });
    }, 350),
    [],
  );

  const safeKeyboardAnimationStyle = useSafeKeyboardAnimationStyle();
  return (
    <Animated.View style={safeKeyboardAnimationStyle}>
      <YStack p="$4" space="$4">
        <YStack
          space="$5"
          $gtMd={{
            flexDirection: 'row',
          }}
        >
          <SegmentControl
            fullWidth={!media.gtMd}
            value={swapSlippageStatus.key}
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
              setSwapSlippageStatus({
                key: keyValue,
                value: swapSlippage.value,
              });
            }}
          />
          <XStack space="$2">
            <SlippageInput
              swapSlippage={swapSlippageStatus}
              onChangeText={handleSlippageChange}
            />
            {swapSlippageStatus.key === ESwapSlippageSegmentKey.CUSTOM ? (
              <XStack>
                {swapSlippageCustomDefaultList.map((item, index) => (
                  <>
                    <Button
                      bg="$bgStrong"
                      key={item}
                      variant="secondary"
                      size="medium"
                      onPress={() => {
                        setSwapSlippageStatus({
                          key: ESwapSlippageSegmentKey.CUSTOM,
                          value: item,
                        });
                      }}
                    >{`${item}%`}</Button>
                    {index !== swapSlippageCustomDefaultList.length - 1 ? (
                      <Divider
                        width={StyleSheet.hairlineWidth}
                        height="100%"
                        bg="$borderSubdued"
                      />
                    ) : null}
                  </>
                ))}
              </XStack>
            ) : null}
          </XStack>
        </YStack>
        {swapSlippageStatus.key === ESwapSlippageSegmentKey.AUTO ? (
          <SizableText size="$bodyMd" color="$textSubdued">
            Auto slippage optimizes slippage based on pool liquidity and trading
            volume, reducing transaction failures and MEV attack risks.
          </SizableText>
        ) : null}
        {swapSlippageStatus.key !== ESwapSlippageSegmentKey.AUTO &&
        customValueState.status !== ESwapSlippageCustomStatus.NORMAL ? (
          <SizableText
            size="$bodySmMedium"
            color={
              customValueState.status === ESwapSlippageCustomStatus.ERROR
                ? '$textCritical'
                : '$textCaution'
            }
          >
            {customValueState.message}
          </SizableText>
        ) : null}
        <Dialog.Footer
          onConfirmText="Save"
          confirmButtonProps={{
            variant: 'primary',
          }}
          onConfirm={() => {
            onSave(swapSlippageStatus);
          }}
        />
      </YStack>
    </Animated.View>
  );
};

export default memo(SwapsSlippageContentContainer);
