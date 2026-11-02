import { memo } from 'react';

import { useIntl } from 'react-intl';

import { Icon, SizableText, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IMarketAccountPortfolioItem } from '@onekeyhq/shared/types/marketV2';

// A missing `pnl` means the server has not said, so only an explicit `false`
// counts as unsupported.
export function hasPnlUnsupportedPosition(
  items: Pick<IMarketAccountPortfolioItem, 'pnl'>[],
): boolean {
  return items.some((item) => item.pnl?.isPnlSupported === false);
}

function PnlUnsupportedHintBase() {
  const intl = useIntl();
  return (
    <XStack
      testID="market-detail-portfolio-pnl-unsupported-hint"
      alignItems="center"
      gap="$1.5"
      px="$5"
      pt="$5"
      pb="$3"
    >
      <Icon name="InfoCircleOutline" size="$4" color="$iconSubdued" />
      <SizableText size="$bodySm" color="$textSubdued" flexShrink={1}>
        {intl.formatMessage({
          id: ETranslations.market_pnl_not_supported_for_token,
        })}
      </SizableText>
    </XStack>
  );
}

export const PnlUnsupportedHint = memo(PnlUnsupportedHintBase);
