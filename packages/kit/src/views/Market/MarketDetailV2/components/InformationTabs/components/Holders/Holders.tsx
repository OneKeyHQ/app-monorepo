import { memo, useCallback } from 'react';

import {
  ListView,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import type { IListViewProps } from '@onekeyhq/components';
import { useMarketHolders } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks/useMarketHolders';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import type { IMarketTokenHolder } from '@onekeyhq/shared/types/marketV2';

interface IHoldersProps {
  tokenAddress: string;
  networkId: string;
}

function HolderItem({
  item,
  index,
}: {
  item: IMarketTokenHolder;
  index: number;
}) {
  const { copyText } = useClipboard();

  const handleCopyAddress = () => {
    copyText(item.accountAddress);
  };

  const formatAmount = (amount: string) => {
    const num = parseFloat(amount);
    if (num < 0.001) {
      return num.toExponential(2);
    }
    return numberFormat(amount, { formatter: 'balance' });
  };

  const formatFiatValue = (fiatValue: string) => {
    const num = parseFloat(fiatValue);
    return numberFormat(num.toString(), { formatter: 'marketCap' });
  };

  return (
    <XStack
      py="$3"
      px="$4"
      borderBottomWidth="$px"
      borderBottomColor="$borderSubdued"
      alignItems="center"
      justifyContent="space-between"
    >
      <XStack alignItems="center" gap="$3" flex={1}>
        <SizableText size="$bodyMd" color="$textSubdued" minWidth="$6">
          #{index + 1}
        </SizableText>

        <XStack
          onPress={handleCopyAddress}
          cursor="pointer"
          hoverStyle={{ bg: '$bgHover' }}
          pressStyle={{ bg: '$bgActive' }}
          borderRadius="$2"
          px="$2"
          py="$1"
          alignItems="center"
          gap="$1"
          flex={1}
        >
          <SizableText size="$bodyMd" color="$text">
            {accountUtils.shortenAddress({
              address: item.accountAddress,
              leadingLength: 6,
              trailingLength: 4,
            })}
          </SizableText>
        </XStack>
      </XStack>

      <YStack alignItems="flex-end" gap="$1">
        <SizableText size="$bodyMd" color="$text">
          {formatAmount(item.amount)}
        </SizableText>
        <SizableText size="$bodySm" color="$textSubdued">
          ${formatFiatValue(item.fiatValue)}
        </SizableText>
      </YStack>
    </XStack>
  );
}

function HoldersSkeleton() {
  return (
    <YStack gap="$3" p="$4">
      {Array.from({ length: 10 }).map((_, index) => (
        <XStack key={index} alignItems="center" justifyContent="space-between">
          <XStack alignItems="center" gap="$3" flex={1}>
            <Skeleton height="$4" width="$6" />
            <Skeleton height="$4" width="$32" />
          </XStack>
          <YStack gap="$2" alignItems="flex-end">
            <Skeleton height="$4" width="$16" />
            <Skeleton height="$3" width="$20" />
          </YStack>
        </XStack>
      ))}
    </YStack>
  );
}

function Holders({ tokenAddress, networkId }: IHoldersProps) {
  const { holders, isRefreshing } = useMarketHolders({
    tokenAddress,
    networkId,
  });

  const renderItem: IListViewProps<IMarketTokenHolder>['renderItem'] =
    useCallback(
      ({ item, index }: { item: IMarketTokenHolder; index: number }) => {
        return (
          <HolderItem key={item.accountAddress} item={item} index={index} />
        );
      },
      [],
    );

  if (isRefreshing && holders.length === 0) {
    return <HoldersSkeleton />;
  }

  if (!isRefreshing && holders.length === 0) {
    return (
      <Stack flex={1} alignItems="center" justifyContent="center" p="$8">
        <SizableText size="$bodyLg" color="$textSubdued">
          No holders found
        </SizableText>
      </Stack>
    );
  }

  return (
    <ListView<IMarketTokenHolder>
      data={holders}
      renderItem={renderItem}
      keyExtractor={(item) => item.accountAddress}
      estimatedItemSize={70}
      showsVerticalScrollIndicator
      contentContainerStyle={{
        paddingBottom: '$4',
      }}
    />
  );
}

export default memo(Holders);
