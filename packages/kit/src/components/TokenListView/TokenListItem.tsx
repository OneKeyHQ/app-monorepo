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
        <XStack alignItems="center" gap="$3" maxWidth="60%">
          <TokenIconView
            networkId={token.networkId}
            icon={token.logoURI}
            isAllNetworks={isAllNetworks}
          />
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
            <XStack alignItems="center" gap="$1">
              <TokenPriceView
                $key={token.$key ?? ''}
                size="$bodyMd"
                color="$textSubdued"
                numberOfLines={1}
              />
              <TokenPriceChangeView
                $key={token.$key ?? ''}
                size="$bodyMd"
                numberOfLines={1}
              />
            </XStack>
          </YStack>
        </XStack>
      );
    }

    return (
      <XStack alignItems="center" gap="$3" flexGrow={1} flexBasis={0}>
        <TokenIconView
          networkId={token.networkId}
          icon={token.logoURI}
          isAllNetworks={isAllNetworks}
        />
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
      </XStack>
    );
  }, [token, isAllNetworks, withNetwork, tableLayout, isTokenSelector]);

  const renderSecondColumn = useCallback(() => {
    if (isTokenSelector) {
      return (
        <YStack
          alignItems="flex-end"
          {...(tableLayout && {
            flexGrow: 1,
            flexBasis: 0,
          })}
          maxWidth="$36"
        >
          <TokenBalanceView
            hideValue={hideValue}
            numberOfLines={1}
            textAlign="right"
            size="$bodyLgMedium"
            $key={token.$key ?? ''}
            symbol=""
          />
          <TokenValueView
            hideValue={hideValue}
            numberOfLines={1}
            size="$bodyMd"
            color="$textSubdued"
            $key={token.$key ?? ''}
          />
        </YStack>
      );
    }

    return (
      <YStack
        alignItems="flex-end"
        {...(tableLayout
          ? {
              flexGrow: 1,
              flexBasis: 0,
              maxWidth: '$36',
            }
          : { flex: 1 })}
      >
        <TokenBalanceView
          hideValue={hideValue}
          numberOfLines={1}
          size={tableLayout ? '$bodyMdMedium' : '$bodyLgMedium'}
          $key={token.$key ?? ''}
          symbol=""
        />
        <TokenValueView
          hideValue={hideValue}
          numberOfLines={1}
          size="$bodyMd"
          color="$textSubdued"
          $key={token.$key ?? ''}
        />
      </YStack>
    );
  }, [hideValue, tableLayout, token.$key, isTokenSelector]);

  const renderThirdColumn = useCallback(() => {
    if (isTokenSelector || !tableLayout) {
      return null;
    }

    return (
      <YStack alignItems="flex-end" flexGrow={1} flexBasis={0}>
        <TokenPriceView
          $key={token.$key ?? ''}
          size="$bodyMdMedium"
          numberOfLines={1}
        />
        <TokenPriceChangeView
          $key={token.$key ?? ''}
          size="$bodyMd"
          numberOfLines={1}
        />
      </YStack>
    );
  }, [isTokenSelector, tableLayout, token.$key]);

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
      gap={tableLayout ? '$3' : '$1'}
      {...rest}
    >
      {renderFirstColumn()}
      {renderSecondColumn()}
      <CreateAccountView
        networkId={token.networkId ?? ''}
        $key={token.$key ?? ''}
      />
      {renderThirdColumn()}
      {renderFourthColumn()}
    </ListItem>
  );
}

export const TokenListItem = memo(BasicTokenListItem);
