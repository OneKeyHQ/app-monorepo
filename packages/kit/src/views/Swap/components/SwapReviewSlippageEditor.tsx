import { useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Button,
  Divider,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { SlippageInput } from '@onekeyhq/kit/src/components/SlippageSettingDialog';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  swapSlippageMaxValue,
  swapSlippageWillAheadMinValue,
  swapSlippageWillFailMinValue,
} from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import {
  ESwapSlippageCustomStatus,
  ESwapSlippageSegmentKey,
} from '@onekeyhq/shared/types/swap/types';

export type ISwapReviewSlippageSaveScope = 'current' | 'future';

const reviewSlippagePresets = [
  { value: 0.5, width: 56 },
  { value: 1, width: 42 },
  { value: 3, width: 45 },
];

export function SwapReviewSlippageEditor({
  initialValue,
  savingScope,
  showTitle = true,
  onSave,
}: {
  initialValue: number;
  savingScope?: ISwapReviewSlippageSaveScope;
  showTitle?: boolean;
  onSave: (
    scope: ISwapReviewSlippageSaveScope,
    slippagePercentage: number,
  ) => void | Promise<void>;
}) {
  const intl = useIntl();
  const [inputValue, setInputValue] = useState(() => initialValue.toString());
  const [isInputFocused, setIsInputFocused] = useState(false);
  const validation = useMemo(() => {
    const value = new BigNumber(inputValue);
    if (value.isNaN()) {
      return {
        status: ESwapSlippageCustomStatus.ERROR,
        message: intl.formatMessage({
          id: ETranslations.slippage_tolerance_error_message,
        }),
      };
    }
    if (value.isNegative() || value.gt(swapSlippageMaxValue)) {
      return {
        status: ESwapSlippageCustomStatus.ERROR,
        message: intl.formatMessage({
          id: ETranslations.slippage_tolerance_error_message,
        }),
        value: value.toNumber(),
      };
    }
    if (value.lte(swapSlippageWillFailMinValue)) {
      return {
        status: ESwapSlippageCustomStatus.WRONG,
        message: intl.formatMessage(
          {
            id: ETranslations.slippage_tolerance_warning_message_2,
          },
          { number: swapSlippageWillFailMinValue },
        ),
        value: value.toNumber(),
      };
    }
    if (value.gte(swapSlippageWillAheadMinValue)) {
      return {
        status: ESwapSlippageCustomStatus.WRONG,
        message: intl.formatMessage(
          {
            id: ETranslations.slippage_tolerance_warning_message_1,
          },
          { number: swapSlippageWillAheadMinValue },
        ),
        value: value.toNumber(),
      };
    }
    return {
      status: ESwapSlippageCustomStatus.NORMAL,
      message: '',
      value: value.toNumber(),
    };
  }, [inputValue, intl]);
  const isSaving = Boolean(savingScope);
  const isSaveDisabled =
    validation.status === ESwapSlippageCustomStatus.ERROR || isSaving;
  const controlSize = platformEnv.isNative ? 'large' : 'medium';
  const handleSave = useCallback(
    (scope: ISwapReviewSlippageSaveScope) => {
      if (isSaveDisabled || validation.value === undefined) {
        return;
      }
      void onSave(scope, validation.value);
    },
    [isSaveDisabled, onSave, validation.value],
  );
  const actionButtons = (
    <XStack gap="$2">
      <Button
        testID="swap-review-slippage-all-future-orders"
        flex={1}
        flexBasis={0}
        minWidth={0}
        size={controlSize}
        borderRadius={platformEnv.isNative ? '$3' : '$2'}
        variant="secondary"
        disabled={isSaveDisabled}
        loading={savingScope === 'future'}
        onPress={() => handleSave('future')}
      >
        {intl.formatMessage({
          id: ETranslations.trade_silp_all_future_orders,
        })}
      </Button>
      <Button
        testID="swap-review-slippage-this-order"
        flex={1}
        flexBasis={0}
        minWidth={0}
        size={controlSize}
        borderRadius={platformEnv.isNative ? '$3' : '$2'}
        variant="primary"
        disabled={isSaveDisabled}
        loading={savingScope === 'current'}
        onPress={() => handleSave('current')}
      >
        {intl.formatMessage({
          id: ETranslations.trade_silp_this_order,
        })}
      </Button>
    </XStack>
  );

  return (
    <YStack gap={validation.message ? '$1.5' : '$4'}>
      {showTitle ? (
        <SizableText size="$headingLg">
          {intl.formatMessage({
            id: ETranslations.trade_silp_edit_slippage,
          })}
        </SizableText>
      ) : null}
      <XStack gap="$2">
        <SlippageInput
          swapSlippage={{
            key: ESwapSlippageSegmentKey.CUSTOM,
            value: validation.value,
          }}
          onChangeText={setInputValue}
          props={{
            size: controlSize,
            disabled: isSaving,
            onFocus: () => setIsInputFocused(true),
            onBlur: () => setIsInputFocused(false),
            containerProps: {
              flex: 1,
              minWidth: 0,
              height: platformEnv.isNative ? 44 : undefined,
              borderRadius: '$3',
              bg: '$bgStrong',
              borderColor: isInputFocused ? '#2f7cf6' : '$borderStrong',
              borderWidth: isInputFocused ? 1.5 : '$px',
            },
          }}
          testID="swap-review-slippage-input"
        />
        <XStack>
          {reviewSlippagePresets.map(({ value, width }, index) => (
            <XStack key={value}>
              <Button
                testID={`swap-review-slippage-preset-${value}`}
                variant="secondary"
                size={controlSize}
                width={width}
                height={platformEnv.isNative ? 44 : undefined}
                px={0}
                borderTopRightRadius={index !== 2 ? 0 : '$3'}
                borderBottomRightRadius={index !== 2 ? 0 : '$3'}
                borderTopLeftRadius={index !== 0 ? 0 : '$3'}
                borderBottomLeftRadius={index !== 0 ? 0 : '$3'}
                disabled={isSaving}
                onPress={() => setInputValue(value.toString())}
              >
                {`${value}%`}
              </Button>
              {index !== reviewSlippagePresets.length - 1 ? (
                <Divider vertical />
              ) : null}
            </XStack>
          ))}
        </XStack>
      </XStack>
      {validation.status !== ESwapSlippageCustomStatus.NORMAL ? (
        <YStack gap="$2">
          <SizableText
            size="$bodyMd"
            color={
              validation.status === ESwapSlippageCustomStatus.ERROR
                ? '$textCritical'
                : '$textCaution'
            }
          >
            {validation.message}
          </SizableText>
          {actionButtons}
        </YStack>
      ) : (
        actionButtons
      )}
    </YStack>
  );
}
