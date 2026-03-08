import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IBorrowAsset } from '@onekeyhq/shared/types/staking';

type IBorrowAssetSelectAction = 'withdraw' | 'repay';

type IBorrowAssetSelectPopoverContentProps = {
  assets: IBorrowAsset[];
  isLoading?: boolean;
  selectedReserveAddress?: string;
  action: IBorrowAssetSelectAction;
  onSelect?: (item: IBorrowAsset) => void;
};

function AssetRow({
  item,
  action,
  isSelected,
  onPress,
}: {
  item: IBorrowAsset;
  action: IBorrowAssetSelectAction;
  isSelected: boolean;
  onPress: () => void;
}) {
  // Get the balance based on action type
  const balance = useMemo(() => {
    if (action === 'withdraw') {
      return item.supplied;
    }
    return item.borrowed;
  }, [action, item.borrowed, item.supplied]);

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
      {/* Asset column */}
      <XStack flex={1} alignItems="center" gap="$2.5">
        <Token size="sm" tokenImageUri={item.token.logoURI} />
        <SizableText size="$bodyMdMedium">{item.token.symbol}</SizableText>
      </XStack>

      {/* Amount column */}
      <YStack alignItems="flex-end" flexShrink={0}>
        <SizableText size="$bodyMd">{balance?.title?.text ?? '-'}</SizableText>
        <SizableText size="$bodySm" color="$textSubdued">
          {balance?.description?.text ?? '-'}
        </SizableText>
      </YStack>
    </XStack>
  );
}

export function BorrowAssetSelectPopoverContent({
  assets,
  isLoading,
  selectedReserveAddress,
  action,
  onSelect,
  closePopover,
}: IBorrowAssetSelectPopoverContentProps & {
  closePopover: () => void;
}) {
  const intl = useIntl();

  const handleSelect = useCallback(
    (item: IBorrowAsset) => {
      onSelect?.(item);
      closePopover();
    },
    [closePopover, onSelect],
  );

  const columnLabel = useMemo(() => {
    if (action === 'withdraw') {
      return intl.formatMessage({
        id: ETranslations.wallet_defi_asset_type_supplied,
      });
    }
    return intl.formatMessage({
      id: ETranslations.wallet_defi_asset_type_borrowed,
    });
  }, [action, intl]);

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
          <Stack w="100%">
            <XStack
              alignItems="center"
              justifyContent="space-between"
              gap="$3"
              py="$2"
              px="$3"
            >
              <XStack flex={1} alignItems="center" gap="$2.5">
                <Skeleton w="$8" h="$8" radius="round" />
                <Stack>
                  <Skeleton w="$12" h="$4" />
                </Stack>
              </XStack>
              <YStack alignItems="flex-end">
                <Skeleton w="$16" h="$4" />
                <Skeleton w="$12" h="$3" mt="$1" />
              </YStack>
            </XStack>
          </Stack>
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
      {/* Header */}
      <XStack px="$3" pb="$1" justifyContent="space-between">
        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.global_asset })}
        </SizableText>
        <SizableText size="$bodySm" color="$textSubdued">
          {columnLabel}
        </SizableText>
      </XStack>

      {/* Asset rows */}
      {assets.map((item) => (
        <AssetRow
          key={item.reserveAddress}
          item={item}
          action={action}
          isSelected={item.reserveAddress === selectedReserveAddress}
          onPress={() => handleSelect(item)}
        />
      ))}
    </YStack>
  );
}

/**
 * Creates a popover content component for token selection in Withdraw/Repay dialogs.
 * Use this with the Popover component's renderContent prop.
 */
export function createBorrowAssetSelectPopoverContent(
  props: IBorrowAssetSelectPopoverContentProps,
) {
  return function PopoverContentWrapper({
    closePopover,
  }: {
    isOpen?: boolean;
    closePopover: () => void;
  }) {
    return (
      <BorrowAssetSelectPopoverContent {...props} closePopover={closePopover} />
    );
  };
}

export type { IBorrowAssetSelectAction, IBorrowAssetSelectPopoverContentProps };
