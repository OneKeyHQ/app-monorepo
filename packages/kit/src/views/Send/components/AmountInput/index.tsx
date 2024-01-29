import { type ComponentProps, memo, useMemo } from 'react';

import { filter, isEmpty, isNumber, uniq } from 'lodash';
import { useIntl } from 'react-intl';

import { Button, IconButton, SizableText, XStack } from '@onekeyhq/components';
import { BaseInput } from '@onekeyhq/kit/src/common/components/BaseInput';

import type { IntlShape } from 'react-intl';

type IAmountInputProps = {
  isUseFiat: boolean;
  linkedAmount: string;
  tokenSymbol: string;
  currencySymbol: string;
  percent?: number[];
  onChangePercent?: (percent: number) => void;
  onChangeAmountMode?: () => void;
} & ComponentProps<typeof BaseInput>;

const DEFAULT_INPUT_PERCENT = [0.25, 0.5, 1];

function getPercentText(percent: number, intl: IntlShape) {
  if (percent === 1) return intl.formatMessage({ id: 'action__max' });
  return `${percent * 100}%`;
}

function AmountInput(props: IAmountInputProps) {
  const intl = useIntl();
  const {
    value: amount,
    placeholder,
    percent,
    isUseFiat,
    linkedAmount,
    tokenSymbol,
    currencySymbol,
    onChangePercent,
    onChangeAmountMode,
    ...rest
  } = props;
  const percentFromProps = uniq(filter(percent, isNumber));

  const inputPercent = isEmpty(percentFromProps)
    ? DEFAULT_INPUT_PERCENT
    : percentFromProps;

  const AmountInputPercent = useMemo(
    () => (
      <XStack space="$2" alignItems="center" justifyContent="space-between">
        <XStack
          space="$1"
          alignItems="center"
          justifyContent="flex-end"
          flex={1}
        >
          {inputPercent.map((item, index) => (
            <Button
              key={index}
              size="small"
              circular
              px={6}
              py={4}
              onPress={() => onChangePercent?.(item)}
            >
              {getPercentText(item, intl)}
            </Button>
          ))}
        </XStack>
      </XStack>
    ),
    [inputPercent, intl, onChangePercent],
  );

  const LinkedAmountSwitch = useMemo(
    () => (
      <XStack pt="$1.5" alignItems="center">
        <SizableText size="$bodyLg" color="$textSubdued" pr="$1">
          ≈
          {isUseFiat
            ? `${linkedAmount} ${tokenSymbol}`
            : `${currencySymbol}${linkedAmount}`}
        </SizableText>
        <IconButton
          title={isUseFiat ? 'Enter amount as token' : 'Enter amount as fiat'}
          icon="SwitchVerOutline"
          size="small"
          iconProps={{
            size: '$4',
          }}
          onPress={onChangeAmountMode}
        />
      </XStack>
    ),
    [currencySymbol, onChangeAmountMode, isUseFiat, linkedAmount, tokenSymbol],
  );

  return (
    <BaseInput
      placeholder={
        placeholder ?? intl.formatMessage({ id: 'action__enter_amount' })
      }
      extension={
        <XStack justifyContent="space-between" alignItems="center">
          {LinkedAmountSwitch}
          {AmountInputPercent}
        </XStack>
      }
      value={amount}
      {...rest}
    />
  );
}

export default memo(AmountInput);
