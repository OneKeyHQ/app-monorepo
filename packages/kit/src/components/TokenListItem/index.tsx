import { NumberSizeableText } from '@onekeyhq/components';
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
  valueProps?: { value: string; currency?: string };
  disabled?: boolean;
} & IListItemProps;

export function TokenListItem({
  tokenImageSrc,
  networkImageSrc,
  tokenName,
  tokenSymbol,
  tokenContrastAddress,
  balance,
  valueProps,
  disabled,
  ...rest
}: ITokenListItemProps) {
  return (
    <ListItem
      userSelect="none"
      {...(disabled && {
        opacity: 0.5,
      })}
      title={tokenSymbol}
      subtitle={tokenContrastAddress || tokenName}
      renderAvatar={
        <Token
          tokenImageUri={tokenImageSrc}
          networkImageUri={networkImageSrc}
        />
      }
      {...rest}
    >
      <ListItem.Text
        align="right"
        primary={
          <NumberSizeableText
            textAlign="right"
            color="$text"
            formatter="balance"
          >
            {balance}
          </NumberSizeableText>
        }
        secondary={
          valueProps?.value ? (
            <NumberSizeableText
              textAlign="right"
              formatter="value"
              color="$textSubdued"
              formatterOptions={{ currency: valueProps?.currency ?? '$' }}
            >
              {valueProps.value}
            </NumberSizeableText>
          ) : null
        }
      />
    </ListItem>
  );
}
