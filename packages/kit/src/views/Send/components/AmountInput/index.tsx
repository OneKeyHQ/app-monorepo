import { type ComponentProps, memo, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Badge, IconButton, SizableText, XStack } from '@onekeyhq/components';
import { BaseInput } from '@onekeyhq/kit/src/common/components/BaseInput';

type IAmountInputProps = {
  isUseFiat: boolean;
  linkedAmount: string;
  tokenSymbol: string;
  currencySymbol: string;
  percent?: number[];
  maxAmount?: string;
  onChangePercent?: (percent: number) => void;
  onChangeAmountMode?: () => void;
} & ComponentProps<typeof BaseInput>;

function AmountInput(props: IAmountInputProps) {
  const intl = useIntl();
  const {
    value: amount,
    placeholder,
    percent,
    maxAmount = '0',
    isUseFiat,
    linkedAmount,
    tokenSymbol,
    currencySymbol,
    onChangePercent,
    onChangeAmountMode,
    ...rest
  } = props;

  const LinkedAmountSwitch = useMemo(
    () => (
      <XStack alignItems="center">
        <SizableText size="$bodyMd" color="$textSubdued" pr="$2">
          ≈
          {isUseFiat
            ? `${linkedAmount} ${tokenSymbol}`
            : `${currencySymbol}${linkedAmount}`}
        </SizableText>
        <IconButton
          title={isUseFiat ? 'Enter amount as token' : 'Enter amount as fiat'}
          icon="SwitchVerOutline"
          iconProps={{
            size: '$3.5',
          }}
          size="small"
          onPress={onChangeAmountMode}
        />
      </XStack>
    ),
    [currencySymbol, onChangeAmountMode, isUseFiat, linkedAmount, tokenSymbol],
  );

  return (
    <BaseInput
      numberOfLines={2}
      placeholder={placeholder ?? 'Enter amount'}
      extension={
        <XStack justifyContent="space-between" alignItems="center">
          {LinkedAmountSwitch}
          <XStack
            alignItems="center"
            userSelect="none"
            p="$1"
            m="$-1"
            hoverStyle={{
              bg: '$bgHover',
            }}
            pressStyle={{
              bg: '$bgActive',
            }}
            borderRadius="$2"
            onPress={() => onChangePercent?.(1)}
          >
            <SizableText
              size="$bodyMd"
              color="$textSubdued"
              pl="$0.5"
              pr="$1.5"
            >
              {intl.formatMessage(
                { id: 'content__balance_str' },
                { 0: maxAmount },
              )}
            </SizableText>
            <Badge badgeSize="sm" badgeType="info">
              {intl.formatMessage({ id: 'action__max' })}
            </Badge>
          </XStack>
        </XStack>
      }
      value={amount}
      {...rest}
    />
  );
}

export default memo(AmountInput);
