import { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import type {
  IIconButtonProps,
  IStackProps,
  IXStackProps,
} from '@onekeyhq/components';
import { IconButton } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { EWatchlistFrom } from '@onekeyhq/shared/src/logger/scopes/market/scenes/token';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';

import { useMarketWatchListV2Atom } from '../../../states/jotai/contexts/marketV2';

import { useWatchListV2Action } from './watchListHooksV2';

export const useStarV2Checked = ({
  chainId,
  contractAddress,
  from,
  isNative = false,
}: {
  chainId: string;
  contractAddress: string;
  from: EWatchlistFrom;
  isNative?: boolean;
}) => {
  const actions = useWatchListV2Action();
  const [{ data: watchListData, isMounted }] = useMarketWatchListV2Atom();

  // Calculate checked state based on atom data
  const checked = useMemo(() => {
    if (!isMounted || watchListData.length === 0) {
      return false;
    }
    return !!watchListData?.find((item) =>
      equalTokenNoCaseSensitive({
        token1: { networkId: chainId, contractAddress },
        token2: {
          networkId: item.chainId,
          contractAddress: item.contractAddress,
        },
      }),
    );
  }, [watchListData, isMounted, chainId, contractAddress]);

  const handlePress = useCallback(async () => {
    if (checked) {
      actions.removeFromWatchListV2(chainId, contractAddress);
      defaultLogger.market.token.removeFromWatchlist({
        tokenSymbol: `${chainId}:${contractAddress}`,
        removeWatchlistFrom: from,
      });
    } else {
      actions.addIntoWatchListV2([{ chainId, contractAddress, isNative }]);
      defaultLogger.market.token.addToWatchList({
        tokenSymbol: `${chainId}:${contractAddress}`,
        addWatchlistFrom: from,
      });
    }
  }, [checked, actions, chainId, contractAddress, from, isNative]);

  return useMemo(
    () => ({
      checked,
      onPress: handlePress,
    }),
    [checked, handlePress],
  );
};

function BasicMarketStarV2({
  chainId,
  contractAddress,
  size,
  from,
  isNative = false,
  ...props
}: {
  size?: IIconButtonProps['size'];
  chainId: string;
  contractAddress: string;
  from: EWatchlistFrom;
  isNative?: boolean;
} & IStackProps) {
  const intl = useIntl();
  const { onPress, checked } = useStarV2Checked({
    chainId,
    contractAddress,
    from,
    isNative,
  });

  return (
    <IconButton
      title={intl.formatMessage({
        id: checked
          ? ETranslations.market_remove_from_watchlist
          : ETranslations.market_add_to_watchlist,
      })}
      icon={checked ? 'StarSolid' : 'StarOutline'}
      variant="tertiary"
      size={size}
      iconSize={size ? undefined : '$5'}
      iconProps={{
        color: checked ? '$iconActive' : '$iconSubdued',
      }}
      onPress={onPress}
      {...(props as IXStackProps)}
    />
  );
}

export const MarketStarV2 = memo(BasicMarketStarV2);
