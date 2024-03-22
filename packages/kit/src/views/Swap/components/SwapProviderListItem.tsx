import { memo, useMemo } from 'react';

import BigNumber from 'bignumber.js';

import {
  Badge,
  Icon,
  NumberSizeableText,
  SizableText,
  XStack,
} from '@onekeyhq/components';
import type { IFetchQuoteResult } from '@onekeyhq/shared/types/swap/types';

import { ListItem } from '../../../components/ListItem';

import type { IListItemProps } from '../../../components/ListItem';

export type ISwapProviderListItemProps = {
  providerResult: IFetchQuoteResult;
  currencySymbol: string;
  toAmountSymbol: string;
  fromTokenAmount?: string;
  fromTokenSymbol?: string;
  disabled?: boolean;
} & IListItemProps;
const SwapProviderListItem = ({
  providerResult,
  currencySymbol,
  toAmountSymbol,
  fromTokenAmount,
  fromTokenSymbol,
  disabled,
  ...rest
}: ISwapProviderListItemProps) => {
  const leftSecondaryComponent = useMemo(() => {
    if (disabled) {
      return (
        <XStack py="$0.5" space="$1" alignItems="center">
          <SizableText size="$bodyMd" color="$textSubdued">
            Unable to fetch the price
          </SizableText>
        </XStack>
      );
    }
    if (providerResult.limit) {
      const fromTokenAmountBN = new BigNumber(fromTokenAmount ?? 0);
      if (providerResult.limit.min) {
        const minBN = new BigNumber(providerResult.limit.min);
        if (fromTokenAmountBN.lt(minBN)) {
          return (
            <XStack py="$0.5" space="$1" alignItems="center">
              <SizableText size="$bodyMd" color="$textSubdued">
                {`Min swap amount requires ${minBN.toFixed()} ${
                  fromTokenSymbol ?? 'unknown'
                }`}
              </SizableText>
            </XStack>
          );
        }
      }
      if (providerResult.limit.max) {
        const maxBN = new BigNumber(providerResult.limit.max);
        if (fromTokenAmountBN.gt(maxBN)) {
          return (
            <XStack py="$0.5" space="$1" alignItems="center">
              <SizableText size="$bodyMd" color="$textSubdued">
                {`Max swap amount requires ${maxBN.toFixed()} ${
                  fromTokenSymbol ?? 'unknown'
                }`}
              </SizableText>
            </XStack>
          );
        }
      }
    }
    if (providerResult.fee?.estimatedFeeFiatValue) {
      return (
        <XStack py="$0.5" space="$1" alignItems="center">
          <Icon name="GasSolid" size="$4" color="$iconSubdued" />
          <NumberSizeableText
            size="$bodyMd"
            color="$textSubdued"
            formatter="value"
            formatterOptions={{
              currency: currencySymbol,
            }}
          >
            {providerResult.fee.estimatedFeeFiatValue}
          </NumberSizeableText>
        </XStack>
      );
    }

    return null;
  }, [
    currencySymbol,
    disabled,
    fromTokenAmount,
    fromTokenSymbol,
    providerResult.fee?.estimatedFeeFiatValue,
    providerResult.limit,
  ]);
  return (
    <ListItem
      avatarProps={{
        src: providerResult.info.providerLogo,
        size: '$10',
        borderRadius: '$2',
      }}
      userSelect="none"
      opacity={disabled ? 0.5 : 1}
      disabled={disabled}
      {...rest}
    >
      <ListItem.Text
        flex={1}
        primary={
          <XStack space="$1.5" alignItems="center">
            <SizableText color="$text" size="$bodyLgMedium">
              {providerResult.info.providerName}
            </SizableText>
            {providerResult.allowanceResult ? (
              <Icon size="$5" color="$iconSubdued" name="LockOutline" />
            ) : null}
          </XStack>
        }
        secondary={leftSecondaryComponent}
      />
      {providerResult.toAmount ? (
        <ListItem.Text
          align="right"
          primary={`${providerResult.toAmount} ${toAmountSymbol}`}
          secondary={
            providerResult.isBest ? (
              <XStack justifyContent="flex-end">
                <Badge badgeType="success" badgeSize="lg">
                  Best
                </Badge>
              </XStack>
            ) : null
          }
        />
      ) : null}
    </ListItem>
  );
};

export default memo(SwapProviderListItem);
