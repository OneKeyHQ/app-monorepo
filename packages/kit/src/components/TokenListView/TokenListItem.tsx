import { memo, useCallback } from 'react';

import { Stack, XStack, YStack } from '@onekeyhq/components';
import type { IListItemProps } from '@onekeyhq/kit/src/components/ListItem';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import type { IAccountToken } from '@onekeyhq/shared/types/token';

import CreateAccountView from './CreateAccountView';
import TokenActionsView from './TokenActionsView';
import TokenBalanceView from './TokenBalanceView';
import TokenIconView from './TokenIconView';
import TokenNameView from './TokenNameView';
import TokenPriceChangeView from './TokenPriceChangeView';
import TokenPriceView from './TokenPriceView';
import TokenValueView from './TokenValueView';

export type ITokenListItemProps = {
  token: IAccountToken;
  onPress?: (token: IAccountToken) => void;
  tableLayout?: boolean;
  withPrice?: boolean;
  withNetwork?: boolean;
  isAllNetworks?: boolean;
  isTokenSelector?: boolean;
  hideValue?: boolean;
  withSwapAction?: boolean;
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
    withSwapAction,
    ...rest
  } = props;

  const renderFirstColumn = useCallback(() => {
    if (!tableLayout && !isTokenSelector) {
      return (
        <YStack flex={1}>
          <TokenNameView
            name={token.symbol}
            isNative={token.isNative}
            isAllNetworks={isAllNetworks}
            networkId={token.networkId}
            withNetwork={withNetwork}
            textProps={{
              size: '$bodyLgMedium',
              flexShrink: 0,
            }}
          />
          <XStack alignItems="center" gap="$0.5">
            <TokenPriceView
              $key={token.$key ?? ''}
              size="$bodyMd"
              color="$textSubdued"
            />
            <TokenPriceChangeView $key={token.$key ?? ''} size="$bodyMd" />
          </XStack>
        </YStack>
      );
    }

    return (
      <YStack flex={1}>
        <TokenNameView
          name={token.symbol}
          isNative={token.isNative}
          isAllNetworks={isAllNetworks}
          networkId={token.networkId}
          withNetwork={withNetwork}
          textProps={{
            size: '$bodyLgMedium',
            flexShrink: 0,
          }}
        />
        <TokenNameView
          name={token.name}
          // name={token.accountId || ''}
          networkId={token.networkId}
          textProps={{
            size: '$bodyMd',
            color: '$textSubdued',
          }}
        />
      </YStack>
    );
  }, [token, isAllNetworks, withNetwork, tableLayout, isTokenSelector]);

  const renderSecondColumn = useCallback(() => {
    if (isTokenSelector || !tableLayout) {
      return null;
    }

    return (
      <YStack alignItems="flex-end" flex={1}>
        <TokenPriceView $key={token.$key ?? ''} size="$bodyLgMedium" />
        <TokenPriceChangeView $key={token.$key ?? ''} size="$bodyMd" />
      </YStack>
    );
  }, [isTokenSelector, tableLayout, token.$key]);

  const renderThirdColumn = useCallback(() => {
    if (isTokenSelector) {
      return (
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
      );
    }

    return (
      <YStack
        alignItems="flex-end"
        {...(tableLayout && {
          flexGrow: 1,
          flexBasis: 0,
        })}
      >
        <TokenValueView
          hideValue={hideValue}
          numberOfLines={1}
          size="$bodyLgMedium"
          $key={token.$key ?? ''}
        />
        <TokenBalanceView
          hideValue={hideValue}
          numberOfLines={1}
          size="$bodyMd"
          color="$textSubdued"
          $key={token.$key ?? ''}
          symbol={token.symbol}
        />
      </YStack>
    );
  }, [hideValue, tableLayout, token.$key, token.symbol, isTokenSelector]);

  const renderFourthColumn = useCallback(() => {
    if (withSwapAction && tableLayout) {
      return (
        <Stack
          alignItems="flex-end"
          {...(tableLayout && {
            flexGrow: 1,
            flexBasis: 0,
          })}
        >
          <TokenActionsView token={token} />
        </Stack>
      );
    }
    return null;
  }, [withSwapAction, tableLayout, token]);

  return (
    <ListItem
      key={token.name}
      userSelect="none"
      onPress={() => {
        onPress?.(token);
      }}
      {...rest}
    >
      <XStack
        flexGrow={1}
        flexBasis={0}
        minWidth={96}
        alignItems="center"
        gap="$3"
      >
        <TokenIconView
          networkId={token.networkId}
          icon={token.logoURI}
          isAllNetworks={isAllNetworks}
        />
        <XStack flex={1} alignItems="center">
          {renderFirstColumn()}
          {renderSecondColumn()}
        </XStack>
      </XStack>
      <Stack w="$8" />
      <Stack
        flexDirection={isTokenSelector ? 'column' : 'column-reverse'}
        alignItems="center"
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
        {renderThirdColumn()}

        {renderFourthColumn()}
      </Stack>
    </ListItem>
  );
}

export const TokenListItem = memo(BasicTokenListItem);
