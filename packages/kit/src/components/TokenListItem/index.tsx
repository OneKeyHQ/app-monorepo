import {
  NumberSizeableText,
  SizableText,
  Stack,
  XStack,
  useMedia,
} from '@onekeyhq/components';
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
  const { gtMd } = useMedia();
  return (
    <ListItem
      userSelect="none"
      {...(disabled && {
        opacity: 0.5,
      })}
      {...rest}
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
            primaryMatch={titleMatchStr}
            primaryTextProps={{
              maxWidth: 170,
              $gtMd: { maxWidth: 300 },
              numberOfLines: 1,
            }}
            secondary={
              isSearch ? (
                <Stack
                  space="$0.5"
                  $gtMd={{ flexDirection: 'row', space: '$1' }}
                >
                  <SizableText
                    maxWidth={170}
                    numberOfLines={1}
                    $gtMd={{ maxWidth: 200 }}
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
        </XStack>
        <ListItem.Text
          align={gtMd ? 'center' : 'left'}
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
