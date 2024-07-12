import { NumberSizeableText, SizableText, Stack } from '@onekeyhq/components';
import type { IListItemProps } from '@onekeyhq/kit/src/components/ListItem';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import type { IFuseResultMatch } from '@onekeyhq/shared/src/modules3rdParty/fuse';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { Token } from '../Token';

export type ITokenListItemProps = {
  tokenImageSrc?: string;
  networkImageSrc?: string;
  tokenName?: string;
  tokenSymbol?: string;
  tokenContrastAddress?: string;
  balance?: string;
  isSearch?: boolean;
  valueProps?: { value: string; currency?: string };
  disabled?: boolean;
  titleMatchStr?: IFuseResultMatch;
} & IListItemProps;

export function TokenListItem({
  tokenImageSrc,
  networkImageSrc,
  tokenName,
  isSearch,
  tokenSymbol,
  tokenContrastAddress,
  balance,
  valueProps,
  disabled,
  titleMatchStr,
  ...rest
}: ITokenListItemProps) {
  return (
    <ListItem
      userSelect="none"
      {...(disabled && {
        opacity: 0.5,
      })}
      {...(isSearch && {
        $md: {
          alignItems: 'flex-start',
        },
      })}
      {...rest}
    >
      <Token tokenImageUri={tokenImageSrc} networkImageUri={networkImageSrc} />
      <ListItem.Text
        flex={1}
        primary={tokenSymbol}
        primaryMatch={titleMatchStr}
        primaryTextProps={{
          numberOfLines: 1,
        }}
        secondary={
          isSearch ? (
            <Stack space="$0.5" $gtMd={{ flexDirection: 'row', space: '$1' }}>
              <SizableText
                numberOfLines={1}
                color="$textSubdued"
                size="$bodyMd"
              >
                {tokenName}
              </SizableText>
              <SizableText color="$textDisabled" size="$bodyMd">
                {accountUtils.shortenAddress({
                  address: tokenContrastAddress,
                  leadingLength: 8,
                  trailingLength: 6,
                })}
              </SizableText>
            </Stack>
          ) : (
            tokenName ?? ''
          )
        }
      />
      <ListItem.Text
        align="right"
        primary={
          <NumberSizeableText
            textAlign="right"
            color="$text"
            formatter="balance"
            size="$bodyLgMedium"
          >
            {balance}
          </NumberSizeableText>
        }
        secondary={
          valueProps?.value ? (
            <NumberSizeableText
              textAlign="right"
              size="$bodyMd"
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
