import { SizableText, XStack } from '@onekeyhq/components';
import type { IListItemProps } from '@onekeyhq/kit/src/components/ListItem';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';

import { Token } from '../Token';

export type ITokenListItemProps = {
  tokenImageSrc?: string;
  networkImageSrc?: string;
  tokenName?: string;
  tokenSymbol?: string;
  tokenContrastAddress?: string;
  balance?: string;
  value?: string;
  disabled?: boolean;
} & IListItemProps;

export function TokenListItem({
  tokenImageSrc,
  networkImageSrc,
  tokenName,
  tokenSymbol,
  tokenContrastAddress,
  balance,
  value,
  disabled,
  ...rest
}: ITokenListItemProps) {
  return (
    <ListItem
      userSelect="none"
      {...(disabled && {
        opacity: 0.5,
      })}
      {...rest}
    >
      <Token tokenImageUri={tokenImageSrc} networkImageUri={networkImageSrc} />
      <ListItem.Text
        flex={1}
        primary={tokenName}
        secondary={
          <XStack>
            <SizableText size="$bodyMd" color="$textSubdued" pr="$1.5">
              {tokenSymbol}
            </SizableText>
            {tokenContrastAddress && (
              <SizableText size="$bodyMd" color="$textDisabled">
                {tokenContrastAddress}
              </SizableText>
            )}
          </XStack>
        }
      />
      <ListItem.Text align="right" primary={balance} secondary={value} />
    </ListItem>
  );
}
