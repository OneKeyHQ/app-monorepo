import { memo, useCallback, useState } from 'react';

import { BigNumber } from 'bignumber.js';
import { debounce } from 'lodash';
import { useIntl } from 'react-intl';

import type { IDialogInstance } from '@onekeyhq/components';
import {
  Button,
  Dialog,
  Divider,
  SegmentControl,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
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

import { SlippageInput } from './SlippageInput';

const SlippageSettingDialog = ({
  swapSlippage,
  onSave,
  autoValue,
  isMEV,
}: {
  swapSlippage: ISwapSlippageSegmentItem;
  autoValue: number;
  onSave: (
    slippage: ISwapSlippageSegmentItem,
    close: IDialogInstance['close'],
  ) => void;
  isMEV: boolean;
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
    [
      intl,
      swapSlippageMaxValue,
      swapSlippageWillFailMinValue,
      swapSlippageWillAheadMinValue,
    ],
  );

  return (
    <YStack gap="$4">
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
        <XStack gap="$2.5">
          <SlippageInput
            swapSlippage={swapSlippageStatus}
            onChangeText={handleSlippageChange}
          />
          <XStack>
            {swapSlippageCustomDefaultList.map(
              (item: number, index: number) => (
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
                    index === swapSlippageCustomDefaultList.length - 1
                      ? '  '
                      : ''
                  }%`}</Button>
                  {index !== swapSlippageCustomDefaultList.length - 1 ? (
                    <Divider vertical />
                  ) : null}
                </>
              ),
            )}
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
      {isMEV ? (
        <>
          <Divider mt="$2" />
          <YStack gap="$1">
            <SizableText size="$bodyLgMedium" color="$text">
              {intl.formatMessage({
                id: ETranslations.mev_protection_label,
              })}
            </SizableText>
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.mev_protection_desc,
              })}
            </SizableText>
          </YStack>
        </>
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
        onConfirm={({ close }) => {
          onSave(swapSlippageStatus, close);
        }}
      />
    </YStack>
  );
};

export default memo(SlippageSettingDialog);
