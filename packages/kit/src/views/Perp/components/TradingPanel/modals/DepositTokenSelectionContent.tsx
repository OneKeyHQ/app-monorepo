import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Empty,
  ListView,
  SearchBar,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import type { IPerpsDepositToken } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { usePerpsDepositTokensAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';

export function DepositTokenSelectionContent({
  symbol,
  depositTokensWithPrice,
  onClose,
  listHeight,
  isLoading,
  hasLoaded,
}: {
  depositTokensWithPrice: IPerpsDepositToken[];
  symbol: string;
  onClose?: () => void;
  listHeight?: number;
  isLoading?: boolean;
  hasLoaded?: boolean;
}) {
  const intl = useIntl();
  const [searchValue, setSearchValue] = useState('');
  const [, setPerpsDepositTokensAtom] = usePerpsDepositTokensAtom();
  const filteredTokens = useMemo(() => {
    const keyword = searchValue.trim().toLowerCase();
    if (!keyword) {
      return depositTokensWithPrice;
    }
    return depositTokensWithPrice.filter((item) => {
      const networkName =
        networkUtils.getLocalNetworkInfo(item.networkId)?.name ?? '';
      return [item.symbol, item.name, networkName].some((field) =>
        field?.toLowerCase().includes(keyword),
      );
    });
  }, [depositTokensWithPrice, searchValue]);
  const shouldShowLoadingSkeleton =
    (!hasLoaded || !!isLoading) && filteredTokens.length === 0;
  const renderTokenItem = useCallback(
    (item: IPerpsDepositToken) => {
      const balanceFormatted = numberFormat(item.balanceParsed ?? '0', {
        formatter: 'balance',
      });
      const fiatValueFormatted = numberFormat(item.fiatValue ?? '0', {
        formatter: 'value',
        formatterOptions: { currency: symbol },
      });
      const networkInfo = networkUtils.getLocalNetworkInfo(item.networkId);
      const networkName = networkInfo?.name;
      return (
        <XStack
          key={`${item.networkId}-${item.contractAddress || item.symbol}`}
          mx="$-2"
          px="$2"
          borderRadius="$4"
          cursor="pointer"
          userSelect="none"
          hoverStyle={{ bg: '$bgHover' }}
          pressStyle={{ bg: '$bgActive' }}
          testID="perp-deposit-token-item"
          onPress={() => {
            setPerpsDepositTokensAtom((prev) => ({
              ...prev,
              currentPerpsDepositSelectedToken: item,
            }));
            onClose?.();
          }}
        >
          <XStack
            width="100%"
            justifyContent="space-between"
            alignItems="center"
            gap="$3"
            py="$2.5"
          >
            <XStack gap="$3" alignItems="center" flex={1} minWidth={0}>
              <Token
                tokenImageUri={item.logoURI}
                networkImageUri={item.networkLogoURI}
                size="md"
              />
              <YStack flex={1} minWidth={0}>
                <SizableText size="$bodyLgMedium" numberOfLines={1}>
                  {item.symbol}
                </SizableText>
                <SizableText
                  size="$bodySm"
                  color="$textSubdued"
                  numberOfLines={1}
                >
                  {item.name || networkName}
                </SizableText>
              </YStack>
            </XStack>
            <YStack alignItems="flex-end" pl="$3" flexShrink={0}>
              <SizableText size="$bodyLgMedium">{balanceFormatted}</SizableText>
              <SizableText size="$bodyMd" color="$textSubdued">
                {fiatValueFormatted}
              </SizableText>
            </YStack>
          </XStack>
        </XStack>
      );
    },
    [symbol, setPerpsDepositTokensAtom, onClose],
  );
  return (
    <YStack flex={1} minHeight={0}>
      <YStack pb="$3">
        <SearchBar
          value={searchValue}
          onChangeText={setSearchValue}
          placeholder={intl.formatMessage({
            id: ETranslations.global_search_tokens,
          })}
          containerProps={{
            bg: '$bgStrong',
            borderRadius: '$full',
          }}
        />
      </YStack>
      <Stack
        flex={listHeight ? undefined : 1}
        height={listHeight}
        minHeight={0}
        mx="$-2"
      >
        <ListView
          useFlashList={platformEnv.isNative}
          flex={1}
          minHeight={0}
          data={filteredTokens}
          keyExtractor={(item) =>
            `${item.networkId}-${item.contractAddress || item.symbol}`
          }
          renderItem={({ item }) => renderTokenItem(item)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            px: '$2',
            py: '$0',
            gap: '$0',
          }}
          ListEmptyComponent={
            shouldShowLoadingSkeleton ? (
              <>
                {Array.from({ length: 5 }).map((_, index) => (
                  <XStack
                    key={String(index)}
                    mx="$-2"
                    px="$2"
                    py="$2.5"
                    gap="$3"
                  >
                    <Skeleton w="$10" h="$10" radius="round" />
                    <YStack flex={1} justifyContent="center" gap="$2">
                      <Skeleton h="$4" w="$32" radius="round" />
                      <Skeleton h="$3" w="$24" radius="round" />
                    </YStack>
                  </XStack>
                ))}
              </>
            ) : (
              <YStack py="$10">
                <Empty
                  illustration="TwoBlocks"
                  title={intl.formatMessage({
                    id: ETranslations.global_no_results,
                  })}
                  description={intl.formatMessage({
                    id: ETranslations.perp_deposit_more_tokens_coming_soon__desc,
                  })}
                />
              </YStack>
            )
          }
        />
      </Stack>
    </YStack>
  );
}
