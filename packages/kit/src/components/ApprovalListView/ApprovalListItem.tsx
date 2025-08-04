import { memo, useCallback } from 'react';

import type { IAccountApproval } from '@onekeyhq/shared/types/approval';

import { ListItem } from '../ListItem';
import { XStack } from '@onekeyhq/components';
import TokenIconView from '../TokenListView/TokenIconView';

type IProps = {
  approval: IAccountApproval;
  tableLayout?: boolean;
};

function ApproveListItem(props: IProps) {
  const { approval, tableLayout } = props;

  const renderFirstColumn = useCallback(() => {
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
    if (!tableLayout) {
      return null;
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
    if (!tableLayout) {
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

export default memo(ApproveListItem);
