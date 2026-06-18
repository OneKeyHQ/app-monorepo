import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Empty, Skeleton, XStack, YStack } from '@onekeyhq/components';
import {
  useSwapProEnableCurrentSymbolAtom,
  useSwapProSupportNetworksTokenListAtom,
  useSwapProSupportNetworksTokenListLoadingAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type {
  IMarketAccountPortfolioPnl,
  IMarketStockInfo,
} from '@onekeyhq/shared/types/marketV2';
import { type ISwapToken } from '@onekeyhq/shared/types/swap/types';

import SwapProPositionItem from '../../components/SwapProPositionItem';
import SwapProPositionListFooter from '../../components/SwapProPositionListFooter';
import SwapProPositionListHeader from '../../components/SwapProPositionListHeader';
import { useSwapProPositionsListFilter } from '../../hooks/useSwapPro';
import { useSwapProPositionsPnl } from '../../hooks/useSwapProPositionsPnl';

interface ISwapProPositionsListProps {
  onTokenPress: (token: ISwapToken) => void;
  onSearchClick?: () => void;
  filterToken?: ISwapToken[];
  cachedTokenList?: ISwapToken[];
  hasCachedTokenList?: boolean;
  positionRows?: {
    token: ISwapToken;
    pnl?: IMarketAccountPortfolioPnl;
  }[];
  isPressable?: boolean;
  showChevron?: boolean;
}

type IPositionTokenWithMarketMeta = ISwapToken & {
  stock?: IMarketStockInfo;
};

const EMPTY_POSITION_TOKEN_LIST: ISwapToken[] = [];

const SwapProPositionsList = ({
  onTokenPress,
  onSearchClick,
  filterToken,
  cachedTokenList,
  hasCachedTokenList,
  positionRows,
  isPressable,
  showChevron,
}: ISwapProPositionsListProps) => {
  const intl = useIntl();
  const [swapProSupportNetworksTokenListLoading] =
    useSwapProSupportNetworksTokenListLoadingAtom();
  const [swapProSupportNetworksTokenList] =
    useSwapProSupportNetworksTokenListAtom();
  const shouldUseCachedTokenList =
    !!hasCachedTokenList &&
    !!cachedTokenList?.length &&
    (swapProSupportNetworksTokenListLoading ||
      swapProSupportNetworksTokenList.length === 0);
  const { finallyTokenList } = useSwapProPositionsListFilter(
    filterToken,
    shouldUseCachedTokenList ? cachedTokenList : undefined,
  );
  const [SwapProCurrentSymbolEnable] = useSwapProEnableCurrentSymbolAtom();
  const shouldUsePositionRows = !!positionRows;
  const pnlMap = useSwapProPositionsPnl(
    shouldUsePositionRows ? EMPTY_POSITION_TOKEN_LIST : finallyTokenList,
  );
  const finalPositionRows = useMemo(() => {
    if (positionRows) {
      return positionRows.map(({ token, pnl }) => {
        const matchedToken = swapProSupportNetworksTokenList.find((item) =>
          equalTokenNoCaseSensitive({ token1: item, token2: token }),
        ) as IPositionTokenWithMarketMeta | undefined;
        const currentToken = token as IPositionTokenWithMarketMeta;
        const localNetwork = networkUtils.getLocalNetworkInfo(token.networkId);
        const isNativeSymbol =
          !!localNetwork?.symbol && localNetwork.symbol === token.symbol;
        const logoURI =
          token.logoURI ??
          matchedToken?.logoURI ??
          (matchedToken?.isNative || token.isNative || isNativeSymbol
            ? localNetwork?.logoURI
            : undefined);
        return {
          token: {
            ...matchedToken,
            ...token,
            isNative: token.isNative ?? matchedToken?.isNative,
            logoURI,
            networkLogoURI:
              token.networkLogoURI ?? matchedToken?.networkLogoURI,
            stock: currentToken.stock ?? matchedToken?.stock,
          },
          pnl,
        };
      });
    }
    return finallyTokenList.map((token) => ({
      token,
      pnl: pnlMap.get(`${token.networkId}-${token.contractAddress}`),
    }));
  }, [finallyTokenList, pnlMap, positionRows, swapProSupportNetworksTokenList]);

  if (
    !shouldUsePositionRows &&
    swapProSupportNetworksTokenListLoading &&
    !shouldUseCachedTokenList
  ) {
    return (
      <YStack gap="$2" p="$2">
        <XStack>
          <Skeleton w="$20" h="$8" radius="round" />
        </XStack>
        <XStack justifyContent="space-between">
          <Skeleton w="$20" h="$5" radius="round" />
          <Skeleton w="$10" h="$5" radius="round" />
        </XStack>
      </YStack>
    );
  }
  return (
    <YStack>
      <SwapProPositionListHeader />
      {finalPositionRows.length > 0 ? (
        finalPositionRows.map(({ token, pnl }) => (
          <SwapProPositionItem
            key={`${token.accountAddress ?? ''}-${token.networkId}-${
              token.contractAddress
            }`}
            token={token}
            onPress={onTokenPress}
            pnl={pnl}
            isPressable={isPressable}
            showChevron={showChevron}
          />
        ))
      ) : (
        <Empty
          icon="SearchOutline"
          title={intl.formatMessage({ id: ETranslations.global_no_results })}
        />
      )}
      {shouldUsePositionRows ||
      SwapProCurrentSymbolEnable ||
      !onSearchClick ? undefined : (
        <SwapProPositionListFooter onSearchClick={onSearchClick} />
      )}
    </YStack>
  );
};

export default SwapProPositionsList;
