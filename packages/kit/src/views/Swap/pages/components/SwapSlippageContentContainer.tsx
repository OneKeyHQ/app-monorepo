import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { BigNumber } from 'bignumber.js';
import { debounce } from 'lodash';
import { useIntl } from 'react-intl';

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
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  swapSlippageCustomDefaultList,
  swapSlippageDecimal,
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
  props,
}: {
  swapSlippage: ISwapSlippageSegmentItem;
  onChangeText: (text: string) => void;
  props?: IInputProps;
}) => {
  const [inputValue, setInputValue] = useState('');
  const handleTextChange = useCallback(
    (text: string) => {
      if (validateAmountInput(text, swapSlippageDecimal)) {
        setInputValue(text);
        onChangeText(text);
      }
    },
    [onChangeText],
  );

  const displaySlippage = useMemo(
    () =>
      new BigNumber(swapSlippage.value)
        .decimalPlaces(swapSlippageDecimal, BigNumber.ROUND_DOWN)
        .toFixed(),
    [swapSlippage.value],
  );

  useEffect(() => {
    setInputValue(displaySlippage);
  }, [displaySlippage]);

  return (
    <Input
      size="medium"
      containerProps={{ flex: 1 }}
      value={inputValue}
      autoFocus={swapSlippage.key === ESwapSlippageSegmentKey.CUSTOM}
      addOns={[{ label: '%' }]}
      textAlign="left"
      disabled={swapSlippage.key === ESwapSlippageSegmentKey.AUTO}
      placeholder={displaySlippage}
      onChangeText={handleTextChange}
      {...props}
    />
  );
};

const SlippageInput = memo(BaseSlippageInput);

const SwapsSlippageContentContainer = ({
  swapSlippage,
  onSave,
  autoValue,
}: {
  swapSlippage: ISwapSlippageSegmentItem;
  autoValue: number;
  onSave: (slippage: ISwapSlippageSegmentItem) => void;
}) => {
  const [swapSlippageStatus, setSwapSlippageStatus] = useState(swapSlippage);
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
          message: intl.formatMessage({
            id: ETranslations.slippage_tolerance_error_message,
          }),
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
          message: intl.formatMessage(
            {
              id: ETranslations.slippage_tolerance_warning_message_2,
            },
            { number: swapSlippageWillFailMinValue },
          ),
        });
        return;
      }
      if (valueBN.gte(swapSlippageWillAheadMinValue)) {
        setCustomValueState({
          status: ESwapSlippageCustomStatus.WRONG,
          message: intl.formatMessage(
            {
              id: ETranslations.slippage_tolerance_warning_message_1,
            },
            { number: swapSlippageWillAheadMinValue },
          ),
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

  return (
    <YStack space="$4">
      <SegmentControl
        fullWidth
        value={swapSlippageStatus.key}
        options={swapSlippageItems.map((item) => ({
          label: intl.formatMessage({
            id:
              item.key === ESwapSlippageSegmentKey.AUTO
                ? ETranslations.slippage_tolerance_switch_auto
                : ETranslations.slippage_tolerance_switch_custom,
          }),
          value: item.key,
        }))}
        onChange={(value) => {
          const keyValue = value as ESwapSlippageSegmentKey;
          setSwapSlippageStatus({
            key: keyValue,
            value:
              keyValue === ESwapSlippageSegmentKey.AUTO
                ? autoValue
                : swapSlippage.value,
          });
        }}
      />
      {swapSlippageStatus.key !== ESwapSlippageSegmentKey.CUSTOM ? (
        <SlippageInput
          swapSlippage={swapSlippageStatus}
          onChangeText={handleSlippageChange}
        />
      ) : null}
      {swapSlippageStatus.key === ESwapSlippageSegmentKey.CUSTOM ? (
        <XStack space="$2.5">
          <SlippageInput
            swapSlippage={swapSlippageStatus}
            onChangeText={handleSlippageChange}
          />
          <XStack>
            {swapSlippageCustomDefaultList.map((item, index) => (
              <>
                <Button
                  key={item}
                  variant="secondary"
                  size="medium"
                  borderTopRightRadius={index !== 2 ? 0 : '$2'}
                  borderBottomRightRadius={index !== 2 ? 0 : '$2'}
                  borderTopLeftRadius={index !== 0 ? 0 : '$2'}
                  borderBottomLeftRadius={index !== 0 ? 0 : '$2'}
                  onPress={() => {
                    setCustomValueState({
                      status: ESwapSlippageCustomStatus.NORMAL,
                      message: '',
                    });
                    setSwapSlippageStatus({
                      key: ESwapSlippageSegmentKey.CUSTOM,
                      value: item,
                    });
                  }}
                >{`${item}${
                  index === swapSlippageCustomDefaultList.length - 1 ? '  ' : ''
                }%`}</Button>
                {index !== swapSlippageCustomDefaultList.length - 1 ? (
                  <Divider vertical />
                ) : null}
              </>
            ))}
          </XStack>
        </XStack>
      ) : null}
      {swapSlippageStatus.key === ESwapSlippageSegmentKey.AUTO ? (
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.slippage_tolerance_description,
          })}
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
        showCancelButton={false}
        onConfirmText={intl.formatMessage({
          id: ETranslations.slippage_tolerance_button_save,
        })}
        confirmButtonProps={{
          variant: 'primary',
          disabled:
            swapSlippageStatus.key === ESwapSlippageSegmentKey.CUSTOM &&
            customValueState.status === ESwapSlippageCustomStatus.ERROR,
        }}
        onConfirm={() => {
          onSave(swapSlippageStatus);
        }}
      />
    </YStack>
  );
};

export default memo(SwapsSlippageContentContainer);
