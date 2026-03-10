import { memo } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

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

const SubtitleBadge = memo(({ subtitle }: { subtitle: string }) => (
  <XStack
    borderRadius="$1"
    bg="$bgStrong"
    justifyContent="center"
    alignItems="center"
    px="$1.5"
  >
    <SizableText fontSize={10} color="$textSubdued" lineHeight={16}>
      {subtitle}
    </SizableText>
  </XStack>
));
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
