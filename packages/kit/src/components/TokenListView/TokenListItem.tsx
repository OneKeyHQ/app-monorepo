import { memo } from 'react';

import { Stack, XStack } from '@onekeyhq/components';
import type { IListItemProps } from '@onekeyhq/kit/src/components/ListItem';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import type { IAccountToken } from '@onekeyhq/shared/types/token';

import { CreateAccountView } from './CreateAccountView';
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
  withNetwork?: boolean;
  isAllNetworks?: boolean;
  isTokenSelector?: boolean;
  hideValue?: boolean;
} & Omit<IListItemProps, 'onPress'>;

function BasicTokenListItem(props: ITokenListItemProps) {
  const {
    token,
    onPress,
    tableLayout,
    withPrice,
    isAllNetworks,
    withNetwork,
    isTokenSelector,
    hideValue,
    ...rest
  } = props;

  return (
    <ListItem
      key={token.name}
      userSelect="none"
      onPress={() => {
        onPress?.(token);
      }}
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
        minWidth={96}
        {...(tableLayout && {
          flexDirection: 'row',
        })}
      >
        <TokenNameView
          name={isTokenSelector ? token.symbol : token.name}
          isNative={token.isNative}
          isAllNetworks={isAllNetworks}
          networkId={token.networkId}
          withNetwork={withNetwork}
          textProps={{
            size: '$bodyLgMedium',
            flexShrink: 0,
          }}
          {...(tableLayout && {
            flexGrow: 1,
            flexBasis: 0,
            textProps: {
              size: '$bodyMdMedium',
            },
          })}
        />
        {isTokenSelector ? (
          <TokenNameView
            name={token.name}
            // name={token.accountId || ''}
            networkId={token.networkId}
            textProps={{
              size: '$bodyMd',
              color: '$textSubdued',
            }}
          />
        ) : (
          <TokenBalanceView
            hideValue={hideValue}
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
        )}
      </Stack>

      <Stack
        flexDirection={isTokenSelector ? 'column' : 'column-reverse'}
        alignItems="flex-end"
        flexShrink={1}
        {...(tableLayout && {
          flexDirection: 'row',
          flexGrow: 1,
          flexBasis: 0,
        })}
      >
        <CreateAccountView
          networkId={token.networkId ?? ''}
          $key={token.$key ?? ''}
        />
        {withPrice ? (
          <XStack
            gap="$2"
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
        {isTokenSelector ? (
          <TokenBalanceView
            hideValue={hideValue}
            numberOfLines={1}
            textAlign="right"
            size="$bodyLgMedium"
            $key={token.$key ?? ''}
            symbol=""
            {...(tableLayout && {
              flexGrow: 1,
              flexBasis: 0,
            })}
          />
        ) : null}
        {isTokenSelector ? (
          <TokenValueView
            hideValue={hideValue}
            numberOfLines={1}
            $key={token.$key ?? ''}
            size="$bodyMd"
            color="$textSubdued"
            textAlign="right"
            {...(tableLayout && {
              flexGrow: 1,
              flexBasis: 0,
              size: '$bodyMdMedium',
            })}
          />
        ) : (
          <TokenValueView
            hideValue={hideValue}
            numberOfLines={1}
            $key={token.$key ?? ''}
            size="$bodyLgMedium"
            textAlign="right"
            {...(tableLayout && {
              flexGrow: 1,
              flexBasis: 0,
              size: '$bodyMdMedium',
            })}
          />
        )}
      </Stack>
    </ListItem>
  );
}

export const TokenListItem = memo(BasicTokenListItem);
