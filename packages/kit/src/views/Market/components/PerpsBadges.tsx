import { memo, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, Stack, Tooltip, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { truncatePerpsSubtitle } from './utils/perpsSubtitle';

const LeverageBadge = memo(({ leverage }: { leverage: number }) => (
  <XStack
    borderRadius="$1"
    bg="$bgInfo"
    justifyContent="center"
    alignItems="center"
    px="$1.5"
  >
    <SizableText fontSize={10} color="$textInfo" lineHeight={16}>
      {leverage}x
    </SizableText>
  </XStack>
));
LeverageBadge.displayName = 'LeverageBadge';

const SubtitleBadge = memo(({ subtitle }: { subtitle: string }) => {
  const normalizedSubtitle = truncatePerpsSubtitle(subtitle);
  const isTruncated = normalizedSubtitle !== subtitle;

  const badgeElement = useMemo(
    () => (
      <XStack
        borderRadius="$1"
        bg="$bgStrong"
        justifyContent="center"
        alignItems="center"
        px="$1.5"
        minWidth={0}
        maxWidth="$24"
        flexShrink={1}
        overflow="hidden"
      >
        <SizableText
          fontSize={10}
          color="$textSubdued"
          lineHeight={16}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {normalizedSubtitle}
        </SizableText>
      </XStack>
    ),
    [normalizedSubtitle],
  );

  if (platformEnv.isNative || !isTruncated) {
    return badgeElement;
  }

  return (
    <Tooltip
      renderTrigger={
        <Stack minWidth={0} flexShrink={1}>
          {badgeElement}
        </Stack>
      }
      renderContent={subtitle}
      placement="top"
    />
  );
});
SubtitleBadge.displayName = 'SubtitleBadge';

const StockIsOpenBadge = memo(({ isOpen }: { isOpen: boolean }) => {
  const intl = useIntl();
  return (
    <XStack
      borderRadius="$1"
      bg={isOpen ? '$bgSuccess' : '$bgStrong'}
      justifyContent="center"
      alignItems="center"
      px="$1.5"
    >
      <SizableText
        fontSize={10}
        color={isOpen ? '$textSuccess' : '$textSubdued'}
        lineHeight={16}
      >
        {intl.formatMessage({
          id: isOpen
            ? ETranslations.dexmarket_stock_status_open
            : ETranslations.dexmarket_stock_status_closed,
        })}
      </SizableText>
    </XStack>
  );
});
StockIsOpenBadge.displayName = 'StockIsOpenBadge';

export { LeverageBadge, StockIsOpenBadge, SubtitleBadge };
