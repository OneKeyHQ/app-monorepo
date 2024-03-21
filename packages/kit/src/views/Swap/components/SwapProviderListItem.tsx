import { memo } from 'react';

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
} & IListItemProps;
const SwapProviderListItem = ({
  providerResult,
  currencySymbol,
  toAmountSymbol,
  ...rest
}: ISwapProviderListItemProps) => (
  <ListItem
    avatarProps={{ src: providerResult.info.providerLogo, size: '$10' }}
    userSelect="none"
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
      secondary={
        providerResult.fee?.estimatedFeeFiatValue ? (
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
              {providerResult.fee?.estimatedFeeFiatValue}
            </NumberSizeableText>
          </XStack>
        ) : null
      }
    />
    <ListItem.Text
      align="right"
      primary={`${providerResult?.toAmount} ${toAmountSymbol}`}
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
  </ListItem>
);

export default memo(SwapProviderListItem);
