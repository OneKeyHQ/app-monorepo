import { memo } from 'react';

import { Stack, XStack } from '@onekeyhq/components';
import type { IListItemProps } from '@onekeyhq/kit/src/components/ListItem';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import type { IAccountToken } from '@onekeyhq/shared/types/token';

import { TokenBalanceView } from './TokenBalanceView';
import { TokenIconView } from './TokenIconView';
import { TokenNameView } from './TokenNameView';
import { TokenPriceChangeView } from './TokenPriceChangeView';
import { TokenPriceView } from './TokenPriceView';
import { TokenValueView } from './TokenValueView';

export type ITokenListItemProps = {
  token: IAccountToken;
  onPress?: (token: IAccountToken) => void;
  tableLayout?: boolean;
  withPrice?: boolean;
  isAllNetworks?: boolean;
} & Omit<IListItemProps, 'onPress'>;

function BasicTokenListItem(props: ITokenListItemProps) {
  const { token, onPress, tableLayout, withPrice, isAllNetworks, ...rest } =
    props;

  return (
    <ListItem
      key={token.name}
      userSelect="none"
      onPress={() => {
        onPress?.(token);
      }}
      // {...(tableLayout &&
      //   index % 2 === 1 && {
      //     bg: '$bgSubdued',
      //   })}
      {...rest}
    >
      <TokenIconView
        tableLayout={tableLayout}
        networkId={token.networkId}
        icon={token.logoURI}
        isAllNetworks={isAllNetworks}
      />
      <Stack
        flexGrow={1}
        flexBasis={0}
        {...(tableLayout && {
          flexDirection: 'row',
        })}
      >
        <XStack
          {...(tableLayout && {
            flexGrow: 1,
            flexBasis: 0,
          })}
        >
          <TokenNameView
            size="$bodyLgMedium"
            minWidth={0}
            numberOfLines={1}
            name={token.name}
            isNative={token.isNative}
            isAllNetworks={isAllNetworks}
            {...(tableLayout && {
              size: '$bodyMdMedium',
            })}
          />
        </XStack>
        <TokenBalanceView
          numberOfLines={1}
          size="$bodyMd"
          color="$textSubdued"
          $key={token.$key ?? ''}
          symbol={token.symbol}
          {...(tableLayout && {
            flexGrow: 1,
            flexBasis: 0,
            color: '$text',
          })}
        />
      </Stack>

      <Stack
        flexDirection="column-reverse"
        alignItems="flex-end"
        {...(tableLayout && {
          flexDirection: 'row',
          flexGrow: 1,
          flexBasis: 0,
        })}
      >
        {withPrice ? (
          <XStack
            space="$2"
            alignItems="center"
            {...(tableLayout && {
              flexGrow: 1,
              flexBasis: 0,
            })}
          >
            {tableLayout ? (
              <TokenPriceView $key={token.$key ?? ''} size="$bodyMd" />
            ) : null}
            <TokenPriceChangeView $key={token.$key ?? ''} size="$bodyMd" />
          </XStack>
        ) : null}
        <TokenValueView
          $key={token.$key ?? ''}
          size="$bodyLgMedium"
          textAlign="right"
          {...(tableLayout && {
            flexGrow: 1,
            flexBasis: 0,
            size: '$bodyMdMedium',
          })}
        />
      </Stack>
    </ListItem>
  );
}

export const TokenListItem = memo(BasicTokenListItem);
