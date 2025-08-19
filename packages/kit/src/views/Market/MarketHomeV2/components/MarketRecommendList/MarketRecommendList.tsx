import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  ScrollView,
  SizableText,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketTokenListItem } from '@onekeyhq/shared/types/marketV2';

import { useWatchListV2Action } from '../../../components/watchListHooksV2';

import { RecommendItem } from './RecommendItem';

interface IMarketRecommendListProps {
  recommendedTokens: IMarketTokenListItem[];
  maxSize?: number;
  onTokenSelect?: (token: IMarketTokenListItem) => void;
  enableSelection?: boolean;
  showTitle?: boolean;
  showAddButton?: boolean;
  networkId?: string;
}

export function MarketRecommendList({
  recommendedTokens,
  maxSize = 8,
  onTokenSelect,
  enableSelection = true,
  showTitle = true,
  showAddButton = true,
  networkId,
}: IMarketRecommendListProps) {
  const intl = useIntl();
  const actions = useWatchListV2Action();

  const defaultAddresses = useMemo(
    () => recommendedTokens?.slice(0, maxSize)?.map((i) => i.address) || [],
    [recommendedTokens, maxSize],
  );

  const [selectedAddresses, setSelectedAddresses] = useState<string[]>(
    enableSelection ? defaultAddresses : [],
  );

  const handleRecommendItemChange = useCallback(
    (checked: boolean, address: string) => {
      if (!enableSelection) {
        const token = recommendedTokens.find((t) => t.address === address);
        if (token && onTokenSelect) {
          onTokenSelect(token);
        }
        return;
      }

      setSelectedAddresses((prev) =>
        checked ? [...prev, address] : prev.filter((i) => i !== address),
      );
    },
    [enableSelection, onTokenSelect, recommendedTokens],
  );

  const handleAddTokens = useCallback(async () => {
    if (showAddButton && enableSelection && networkId) {
      const items = selectedAddresses.map((address) => ({
        chainId: networkId,
        contractAddress: address,
      }));

      actions.addIntoWatchListV2(items);

      setTimeout(() => {
        setSelectedAddresses(defaultAddresses);
      }, 50);
    }
  }, [
    actions,
    selectedAddresses,
    defaultAddresses,
    showAddButton,
    enableSelection,
    networkId,
  ]);

  const { gtMd } = useMedia();

  const confirmButton = useMemo(
    () =>
      showAddButton && enableSelection ? (
        <Button
          width="100%"
          size="large"
          disabled={!selectedAddresses.length}
          variant="primary"
          onPress={handleAddTokens}
        >
          {intl.formatMessage(
            {
              id: ETranslations.market_add_number_tokens,
            },
            { number: selectedAddresses.length || 0 },
          )}
        </Button>
      ) : null,
    [
      selectedAddresses.length,
      handleAddTokens,
      intl,
      showAddButton,
      enableSelection,
    ],
  );

  const stackPaddingBottom = useMemo(() => {
    if (platformEnv.isNativeAndroid) return 100;
    if (platformEnv.isExtension) return 50;
    return 0;
  }, []);

  if (!recommendedTokens?.length) {
    return null;
  }

  return (
    <Stack flex={1} paddingBottom={stackPaddingBottom}>
      <ScrollView
        contentContainerStyle={{ ai: 'center' }}
        px="$5"
        display="flex"
        py={platformEnv.isExtensionUiPopup ? '$5' : '$8'}
      >
        {showTitle ? (
          <>
            <SizableText
              size={
                platformEnv.isExtensionUiPopup ? '$headingXl' : '$heading3xl'
              }
            >
              {intl.formatMessage({
                id: ETranslations.market_empty_watchlist_title,
              })}
            </SizableText>
            <SizableText
              size={
                platformEnv.isExtensionUiPopup
                  ? '$bodyMdMedium'
                  : '$bodyLgMedium'
              }
              pt="$2"
            >
              {intl.formatMessage({
                id: ETranslations.market_empty_watchlist_desc,
              })}
            </SizableText>
          </>
        ) : null}
        <YStack
          pt={showTitle ? '$8' : '$0'}
          gap="$2.5"
          flexWrap="wrap"
          width="100%"
          $gtMd={{ maxWidth: 480 }}
          $sm={{
            gap: '$2',
          }}
        >
          {new Array(Math.ceil(maxSize / 2)).fill(0).map((_, i) => (
            <XStack
              gap="$2.5"
              key={i}
              $sm={{
                gap: '$2',
              }}
            >
              {new Array(2).fill(0).map((__, j) => {
                const item = recommendedTokens?.[i * 2 + j];
                return item ? (
                  <RecommendItem
                    key={item.address}
                    address={item.address}
                    checked={
                      enableSelection
                        ? selectedAddresses.includes(item.address)
                        : false
                    }
                    icon={item.logoUrl || ''}
                    symbol={item.symbol}
                    tokenName={item.name}
                    networkId={item.networkId || item.chainId}
                    onChange={handleRecommendItemChange}
                  />
                ) : null;
              })}
            </XStack>
          ))}
          {gtMd && confirmButton ? (
            <YStack pt="$8">{confirmButton}</YStack>
          ) : null}
        </YStack>
      </ScrollView>
      {!gtMd && confirmButton ? <YStack p="$5">{confirmButton}</YStack> : null}
    </Stack>
  );
}
