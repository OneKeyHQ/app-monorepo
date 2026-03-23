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

import type { GestureResponderEvent } from 'react-native';

const handlePress = (e: GestureResponderEvent) => {
  e.stopPropagation();
};

interface ITokenTagsPopoverProps {
  communityRecognized?: boolean;
  stock?: IMarketStockInfo;
}

function TokenTagsPopover({
  communityRecognized,
  stock,
}: ITokenTagsPopoverProps) {
  const intl = useIntl();

  const hasStockSource = !!stock?.sourceLogoUri;
  const hasTags = communityRecognized || hasStockSource;

  const stockLabelId = useMemo(() => {
    if (!stock?.source) return undefined;
    if (stock.source === 'ondo') return ETranslations.dexmarket_tokenized_ondo;
    if (stock.source === 'xstock')
      return ETranslations.dexmarket_tokenized_xstock;
    return undefined;
  }, [stock?.source]);

  if (!hasTags) {
    return null;
  }

  const triggerIcons = (
    <XStack alignItems="center" gap="$1">
      {hasStockSource ? (
        <Image
          width={14}
          height={14}
          borderRadius="$full"
          source={{ uri: stock.sourceLogoUri }}
        />
      ) : null}
      {communityRecognized ? (
        <Icon name="BadgeRecognizedSolid" size="$4" color="$iconSuccess" />
      ) : null}
    </XStack>
  );

  return (
    <Stack onPress={handlePress}>
      <Popover
        title={intl.formatMessage({ id: ETranslations.send_tag })}
        placement="bottom"
        renderTrigger={triggerIcons}
        renderContent={
          <YStack px="$5" pb="$5" pt="$1" gap="$4">
            {communityRecognized ? (
              <XStack alignItems="center" gap="$3">
                <Icon
                  name="BadgeRecognizedSolid"
                  size="$6"
                  color="$iconSuccess"
                />
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
          </YStack>
        }
      />
    </Stack>
  );
}

const MemoTokenTagsPopover = memo(TokenTagsPopover);
export { MemoTokenTagsPopover as TokenTagsPopover };
