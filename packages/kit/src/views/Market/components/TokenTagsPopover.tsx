import type { ReactNode } from 'react';
import { memo, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  Image,
  Popover,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IMarketStockInfo } from '@onekeyhq/shared/types/marketV2';

import { StockIsOpenBadge, SubtitleBadge } from './PerpsBadges';

import type { GestureResponderEvent } from 'react-native';

const handlePress = (e: GestureResponderEvent) => {
  e.stopPropagation();
};

interface ITokenTagsPopoverProps {
  communityRecognized?: boolean;
  stock?: IMarketStockInfo;
  /** Show subtitle & stock status badges in trigger. Defaults to false. */
  showAllInTrigger?: boolean;
  /** Hide community badge from trigger (shown separately e.g. in header). */
  hideCommunityInTrigger?: boolean;
  /** Custom trigger element. Overrides default trigger rendering. */
  customTrigger?: ReactNode;
  /** Disable truncation for subtitle badge. Defaults to false. */
  noTruncateSubtitle?: boolean;
}

function TokenTagsPopover({
  communityRecognized,
  stock,
  showAllInTrigger = false,
  hideCommunityInTrigger = false,
  customTrigger,
  noTruncateSubtitle = false,
}: ITokenTagsPopoverProps) {
  const intl = useIntl();

  const hasStockSource = !!stock?.sourceLogoUri;
  const hasSubtitle = !!stock?.subtitle;
  const hasStockStatus = !!stock;
  const hasTags =
    communityRecognized || hasStockSource || hasSubtitle || hasStockStatus;

  // Check if trigger has any visible element (avoid empty pressable area)
  const hasTriggerContent =
    !!customTrigger ||
    hasStockSource ||
    (communityRecognized && !hideCommunityInTrigger) ||
    (showAllInTrigger && (hasSubtitle || hasStockStatus));

  const stockLabelId = useMemo(() => {
    if (!stock?.source) return undefined;
    if (stock.source === 'ondo') return ETranslations.dexmarket_tokenized_ondo;
    if (stock.source === 'xstock')
      return ETranslations.dexmarket_tokenized_xstock;
    return undefined;
  }, [stock?.source]);

  if (!hasTags || !hasTriggerContent) {
    return null;
  }

  const triggerElements = customTrigger ?? (
    <XStack alignItems="center" gap="$1">
      {hasStockSource ? (
        <Image
          width={14}
          height={14}
          borderRadius="$full"
          source={{ uri: stock.sourceLogoUri }}
        />
      ) : null}
      {communityRecognized && !hideCommunityInTrigger ? (
        <Icon name="BadgeRecognizedSolid" size="$4" color="$iconSuccess" />
      ) : null}
      {showAllInTrigger && hasSubtitle ? (
        <SubtitleBadge
          subtitle={stock.subtitle ?? ''}
          noTruncate={noTruncateSubtitle}
        />
      ) : null}
      {showAllInTrigger && hasStockStatus ? (
        <StockIsOpenBadge stock={stock} />
      ) : null}
    </XStack>
  );

  const popoverContent = (
    <YStack px="$5" pb="$5" pt="$1" gap="$4">
      {communityRecognized ? (
        <XStack alignItems="center" gap="$3">
          <Icon name="BadgeRecognizedSolid" size="$6" color="$iconSuccess" />
          <SizableText size="$bodyLgMedium" flex={1} flexWrap="wrap">
            {intl.formatMessage({
              id: ETranslations.dexmarket_communityRecognized,
            })}
          </SizableText>
        </XStack>
      ) : null}
      {hasStockSource ? (
        <XStack alignItems="center" gap="$3">
          <Stack
            width="$6"
            height="$6"
            alignItems="center"
            justifyContent="center"
          >
            <Image
              width={20}
              height={20}
              borderRadius="$full"
              source={{ uri: stock.sourceLogoUri }}
            />
          </Stack>
          <SizableText size="$bodyLgMedium" flex={1} flexWrap="wrap">
            {stockLabelId
              ? intl.formatMessage({ id: stockLabelId })
              : stock?.title}
          </SizableText>
        </XStack>
      ) : null}
      {hasStockStatus ? (
        <YStack gap="$2">
          <XStack>
            <StockIsOpenBadge stock={stock} />
          </XStack>
          {stock.description ? (
            <SizableText size="$bodyMd" color="$textSubdued">
              {stock.description}
            </SizableText>
          ) : null}
        </YStack>
      ) : null}
    </YStack>
  );

  return (
    <Stack onPress={handlePress}>
      <Popover
        title={intl.formatMessage({ id: ETranslations.send_tag })}
        placement="bottom"
        renderTrigger={triggerElements}
        renderContent={popoverContent}
      />
    </Stack>
  );
}

const MemoTokenTagsPopover = memo(TokenTagsPopover);
export { MemoTokenTagsPopover as TokenTagsPopover };
