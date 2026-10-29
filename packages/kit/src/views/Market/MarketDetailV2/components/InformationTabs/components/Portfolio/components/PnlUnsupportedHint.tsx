import { memo } from 'react';

import { Icon, SizableText, XStack } from '@onekeyhq/components';
import type { IMarketAccountPortfolioItem } from '@onekeyhq/shared/types/marketV2';

// TODO: replace with a translation key once the copy is translated.
const PNL_UNSUPPORTED_HINT_TEXT =
  "PnL calculation isn't supported for this token.";

// A missing `pnl` means the server has not said, so only an explicit `false`
// counts as unsupported.
export function hasPnlUnsupportedPosition(
  items: Pick<IMarketAccountPortfolioItem, 'pnl'>[],
): boolean {
  return items.some((item) => item.pnl?.isPnlSupported === false);
}

function PnlUnsupportedHintBase() {
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
        {PNL_UNSUPPORTED_HINT_TEXT}
      </SizableText>
    </XStack>
  );
}

export const PnlUnsupportedHint = memo(PnlUnsupportedHintBase);
