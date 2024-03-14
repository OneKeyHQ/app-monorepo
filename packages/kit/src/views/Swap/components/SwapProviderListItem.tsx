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
        <XStack space="$1">
          <SizableText color="$text">
            {providerResult.info.providerName}
          </SizableText>
          {providerResult.allowanceResult ? <Icon name="LockOutline" /> : null}
        </XStack>
      }
      secondary={
        providerResult.fee.estimatedFeeFiatValue ? (
          <XStack>
            <Icon name="GasSolid" size="4" />
            <NumberSizeableText
              formatter="value"
              formatterOptions={{
                currency: currencySymbol,
              }}
            >
              {providerResult.fee.estimatedFeeFiatValue}
            </NumberSizeableText>
          </XStack>
        ) : null
      }
    />
    <ListItem.Text
      align="right"
      primary={`${providerResult.toAmount} ${toAmountSymbol}`}
      secondary={
        providerResult.isBest ? (
          <XStack justifyContent="flex-end">
            <Badge badgeType="success" badgeSize="sm" w="$10">
              Best
            </Badge>
          </XStack>
        ) : null
      }
    />
  </ListItem>
);

export default memo(SwapProviderListItem);
