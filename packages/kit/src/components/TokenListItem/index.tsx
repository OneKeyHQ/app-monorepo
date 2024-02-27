import { SizableText, XStack } from '@onekeyhq/components';
import type { IListItemProps } from '@onekeyhq/kit/src/components/ListItem';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';

export type ITokenListItemProps = {
  tokenImageSrc?: string;
  networkImageSrc?: string;
  tokenName?: string;
  tokenSymbol?: string;
  tokenContrastAddress?: string;
  balance?: string;
  value?: string;
} & IListItemProps;

export function TokenListItem({
  tokenImageSrc,
  networkImageSrc,
  tokenName,
  tokenSymbol,
  tokenContrastAddress,
  balance,
  value,
  ...rest
}: ITokenListItemProps) {
  return (
    <ListItem userSelect="none" {...rest}>
      <ListItem.Avatar
        src={tokenImageSrc}
        cornerImageProps={{
          src: networkImageSrc,
        }}
      />
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
