import {
  NumberSizeableText,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';
import type { IListItemProps } from '@onekeyhq/kit/src/components/ListItem';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
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
  ...rest
}: ITokenListItemProps) {
  return (
    <ListItem
      userSelect="none"
      {...(disabled && {
        opacity: 0.5,
      })}
    >
      <XStack flex={1} justifyContent="space-between">
        <XStack
          space="$3"
          alignItems="flex-start"
          $gtMd={{ alignItems: 'center' }}
        >
          <Token
            tokenImageUri={tokenImageSrc}
            networkImageUri={networkImageSrc}
          />
          <ListItem.Text
            primary={tokenSymbol}
            primaryMatch={rest.titleMatch}
            secondary={
              isSearch ? (
                <Stack space="$1" $gtMd={{ flexDirection: 'row' }}>
                  <SizableText color="$textSubdued" size="$bodyMd">
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
        </XStack>
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
      </XStack>
    </ListItem>
  );
}
