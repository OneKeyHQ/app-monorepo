import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { Button, XStack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EWatchlistFrom } from '@onekeyhq/shared/src/logger/scopes/dex';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketBasicConfigToken } from '@onekeyhq/shared/types/marketV2';

import { useWatchListV2Action } from '../../../components/watchListHooksV2';
import { getRecommendTokenNetworkId } from '../../../utils/getRecommendTokenNetworkId';
import { mapRecommendTokensToWatchlistItems } from '../../../utils/mapRecommendTokensToWatchlistItems';
import { orderSelectedRecommendTokens } from '../../../utils/orderSelectedRecommendTokens';
import { getMarketRecommendContainerPaddingTop } from '../../layouts/mobileLayoutUtils';

import { RecommendItem } from './RecommendItem';

function getTokenKey(token: { chainId: string; contractAddress: string }) {
  return `${token.chainId}:${token.contractAddress}`;
}

interface IMarketRecommendListProps {
  recommendedTokens: IMarketBasicConfigToken[];
  maxSize?: number;
  onTokenSelect?: (token: IMarketBasicConfigToken) => void;
  enableSelection?: boolean;
}

export function MarketRecommendList({
  recommendedTokens,
  maxSize = 8,
  onTokenSelect,
  enableSelection = true,
}: IMarketRecommendListProps) {
  const intl = useIntl();
  const actions = useWatchListV2Action();
  // No heading on any platform: the Watchlist tab already says where the
  // user is, and native's translateY offsets are calibrated for title-less
  // content (OK-57820).
  const containerPaddingTop = platformEnv.isExtensionUiPopup
    ? 0
    : getMarketRecommendContainerPaddingTop({
        isNative: Boolean(platformEnv.isNative),
      });

  const uniqueTokens = useMemo(() => {
    if (!recommendedTokens?.length) return [];
    const seen = new Set<string>();
    return recommendedTokens.filter((token) => {
      const key = getTokenKey(token);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [recommendedTokens]);

  const defaultTokens = useMemo(
    () => uniqueTokens.slice(0, maxSize),
    [uniqueTokens, maxSize],
  );

  const [selectedTokens, setSelectedTokens] = useState<
    IMarketBasicConfigToken[]
  >(enableSelection ? defaultTokens : []);
  const [isAdding, setIsAdding] = useState(false);
  const isAddingRef = useRef(false);

  useEffect(() => {
    setSelectedTokens(enableSelection ? defaultTokens : []);
  }, [enableSelection, defaultTokens]);

  const handleRecommendItemChange = useCallback(
    (checked: boolean, tokenKey: string) => {
      if (isAddingRef.current) {
        return;
      }
      const token = uniqueTokens.find((t) => getTokenKey(t) === tokenKey);
      if (!token) return;

      if (!enableSelection) {
        onTokenSelect?.(token);
        return;
      }

      setSelectedTokens((prev) =>
        checked
          ? [...prev, token]
          : prev.filter((t) => getTokenKey(t) !== tokenKey),
      );
    },
    [enableSelection, onTokenSelect, uniqueTokens],
  );

  const handleAddTokens = useCallback(async () => {
    if (!enableSelection || isAddingRef.current) {
      return;
    }
    isAddingRef.current = true;
    setIsAdding(true);
    try {
      const orderedTokens = orderSelectedRecommendTokens(
        defaultTokens,
        selectedTokens,
        getTokenKey,
      );
      const items = mapRecommendTokensToWatchlistItems(orderedTokens);

      const added = await actions.addIntoWatchListV2(items, {
        preserveOrder: true,
      });
      if (!added) {
        return;
      }

      // Log analytics for each token added to watchlist from recommend list
      orderedTokens.forEach((token) => {
        defaultLogger.dex.watchlist.dexAddToWatchlist({
          network: token.chainId,
          tokenSymbol: token.symbol || '',
          tokenContract: token.contractAddress,
          addFrom: EWatchlistFrom.Recommend,
        });
      });

      setTimeout(() => {
        setSelectedTokens(defaultTokens);
      }, 50);
    } finally {
      isAddingRef.current = false;
      setIsAdding(false);
    }
  }, [actions, selectedTokens, defaultTokens, enableSelection]);

  const confirmButton = useMemo(
    () =>
      enableSelection ? (
        <Button
          testID="market-confirm-button-btn"
          width="100%"
          size="large"
          disabled={!selectedTokens.length || isAdding}
          loading={isAdding}
          variant="primary"
          onPress={handleAddTokens}
        >
          {intl.formatMessage(
            {
              id: ETranslations.market_add_number_tokens,
            },
            { number: selectedTokens.length || 0 },
          )}
        </Button>
      ) : null,
    [selectedTokens.length, handleAddTokens, intl, enableSelection, isAdding],
  );

  if (!uniqueTokens.length) {
    return null;
  }

  return (
    <YStack
      px="$5"
      pt={containerPaddingTop}
      pb="$2"
      jc="center"
      ai="center"
      width="100%"
    >
      <YStack
        gap="$2.5"
        width="100%"
        $gtMd={{ maxWidth: 480 }}
        $sm={{
          gap: '$2',
        }}
      >
        {new Array(Math.ceil(defaultTokens.length / 2)).fill(0).map((_, i) => (
          <XStack
            gap="$2.5"
            key={i}
            $sm={{
              gap: '$2',
            }}
          >
            {new Array(2).fill(0).map((__, j) => {
              const item = defaultTokens[i * 2 + j];
              if (!item) return null;
              const tokenKey = getTokenKey(item);
              const isChecked =
                enableSelection &&
                selectedTokens.some((t) => getTokenKey(t) === tokenKey);
              return (
                <RecommendItem
                  key={tokenKey}
                  address={tokenKey}
                  checked={isChecked}
                  disabled={isAdding}
                  icon={item.logo || ''}
                  symbol={item.symbol}
                  tokenName={item.name}
                  networkId={getRecommendTokenNetworkId(item)}
                  onChange={handleRecommendItemChange}
                />
              );
            })}
          </XStack>
        ))}
        <YStack pt="$6">{confirmButton}</YStack>
      </YStack>
    </YStack>
  );
}
