import { memo, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Image,
  SizableText,
  Stack,
  Tooltip,
  XStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketStockInfo } from '@onekeyhq/shared/types/marketV2';

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

const StockIsOpenBadge = memo(({ stock }: { stock: IMarketStockInfo }) => {
  const intl = useIntl();
  const { isOpen, description } = stock;

  const statusText = intl.formatMessage({
    id: isOpen
      ? ETranslations.dexmarket_stock_status_open
      : ETranslations.dexmarket_stock_status_closed,
  });

  const badge = (
    <XStack
      borderRadius="$1"
      bg={isOpen ? '$bgSuccess' : '$bgCaution'}
      justifyContent="center"
      alignItems="center"
      px="$1.5"
    >
      <SizableText
        fontSize={10}
        color={isOpen ? '$textSuccess' : '$textCaution'}
        lineHeight={16}
      >
        {statusText}
      </SizableText>
    </XStack>
  );

  if (!description) {
    return badge;
  }

  return (
    <Tooltip
      hovering
      placement="bottom"
      renderContent={description}
      renderTrigger={<Stack cursor="pointer">{badge}</Stack>}
    />
  );
});
StockIsOpenBadge.displayName = 'StockIsOpenBadge';

const StockSourceLogo = memo(
  ({ stock }: { stock: IMarketStockInfo | undefined }) => {
    if (!stock?.sourceLogoUri) {
      return null;
    }

    const image = (
      <Image
        width={14}
        height={14}
        borderRadius="$full"
        source={{ uri: stock.sourceLogoUri }}
      />
    );

    if (stock.title) {
      return (
        <Tooltip
          hovering
          placement="top"
          renderContent={stock.title}
          renderTrigger={<Stack cursor="pointer">{image}</Stack>}
        />
      );
    }

    return image;
  },
);
StockSourceLogo.displayName = 'StockSourceLogo';

export { LeverageBadge, StockIsOpenBadge, StockSourceLogo, SubtitleBadge };
