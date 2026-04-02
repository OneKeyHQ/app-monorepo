import { useCallback } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  NumberSizeableText,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IEarnTokenItem } from '@onekeyhq/shared/types/staking';

type IStakeAssetSelectPopoverContentProps = {
  assets: IEarnTokenItem[];
  isLoading?: boolean;
  selectedUniqueKey?: string;
  onSelect?: (item: IEarnTokenItem) => void;
};

function formatFiatValue(fiatValue?: string) {
  const fiatValueBN = new BigNumber(fiatValue || '0');
  if (fiatValueBN.isNaN() || fiatValueBN.lte(0)) {
    return '$0.00';
  }
  return `$${fiatValueBN.toFixed(2)}`;
}

function AssetRow({
  item,
  isSelected,
  onPress,
}: {
  item: IEarnTokenItem;
  isSelected: boolean;
  onPress: () => void;
}) {
  return (
    <XStack
      py="$2"
      px="$3"
      gap="$3"
      alignItems="center"
      justifyContent="space-between"
      hoverStyle={isSelected ? undefined : { bg: '$bgHover' }}
      pressStyle={isSelected ? undefined : { bg: '$bgActive' }}
      bg={isSelected ? '$bgHover' : undefined}
      cursor={isSelected ? 'default' : 'pointer'}
      onPress={isSelected ? undefined : onPress}
      borderRadius="$2"
    >
      <XStack flex={1} alignItems="center" gap="$2.5">
        <Token size="sm" tokenImageUri={item.info.logoURI} />
        <SizableText size="$bodyMdMedium" numberOfLines={1}>
          {item.info.symbol}
        </SizableText>
      </XStack>

      <YStack alignItems="flex-end" flexShrink={0}>
        <NumberSizeableText size="$bodyMd" formatter="balance">
          {item.balanceParsed || '0'}
        </NumberSizeableText>
        <SizableText size="$bodySm" color="$textSubdued">
          {formatFiatValue(item.fiatValue)}
        </SizableText>
      </YStack>
    </XStack>
  );
}

export function StakeAssetSelectPopoverContent({
  assets,
  isLoading,
  selectedUniqueKey,
  onSelect,
  closePopover,
}: IStakeAssetSelectPopoverContentProps & {
  closePopover: () => void;
}) {
  const intl = useIntl();

  const handleSelect = useCallback(
    (item: IEarnTokenItem) => {
      onSelect?.(item);
      closePopover();
    },
    [closePopover, onSelect],
  );

  if (isLoading) {
    return (
      <Stack position="relative" overflow="hidden">
        <YStack p="$5" alignItems="center">
          <SizableText size="$bodyMd" color="transparent">
            {intl.formatMessage({ id: ETranslations.global_no_results })}
          </SizableText>
        </YStack>
        <Stack
          position="absolute"
          top={0}
          right={0}
          bottom={0}
          left={0}
          ai="center"
          jc="center"
          pointerEvents="none"
        >
          <XStack
            alignItems="center"
            justifyContent="space-between"
            gap="$3"
            py="$2"
            px="$3"
            w="100%"
          >
            <XStack flex={1} alignItems="center" gap="$2.5">
              <Skeleton w="$8" h="$8" radius="round" />
              <Skeleton w="$12" h="$4" />
            </XStack>
            <YStack alignItems="flex-end">
              <Skeleton w="$16" h="$4" />
              <Skeleton w="$12" h="$3" mt="$1" />
            </YStack>
          </XStack>
        </Stack>
      </Stack>
    );
  }

  if (!assets.length) {
    return (
      <YStack p="$5" alignItems="center">
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.global_no_results })}
        </SizableText>
      </YStack>
    );
  }

  return (
    <YStack p="$2">
      <XStack px="$3" pb="$1" justifyContent="space-between">
        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.global_asset })}
        </SizableText>
        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.global_wallet_balance })}
        </SizableText>
      </XStack>

      {assets.map((item) => {
        const itemUniqueKey =
          item.info.uniqueKey ||
          `${item.info.isNative ? 'native' : item.info.address}-${item.info.symbol}`;
        return (
          <AssetRow
            key={itemUniqueKey}
            item={item}
            isSelected={itemUniqueKey === selectedUniqueKey}
            onPress={() => handleSelect(item)}
          />
        );
      })}
    </YStack>
  );
}
