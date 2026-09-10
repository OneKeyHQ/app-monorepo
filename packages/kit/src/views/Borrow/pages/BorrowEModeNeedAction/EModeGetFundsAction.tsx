import { useIntl } from 'react-intl';

import { Button } from '@onekeyhq/components';
import { BorrowTestIDs } from '@onekeyhq/kit/src/views/Borrow/testIDs';
import { ETranslations } from '@onekeyhq/shared/src/locale';

// The remedy for an underfunded step, sized to sit in the page footer next to
// the blocked action — the shape Send uses when a balance is short (see its
// insufficient-funds footer, which pairs the same two labels).
//
// It swaps outright instead of offering a menu. A picker between Swap and
// Receive asked the user to choose a route at the exact moment the screen had
// already told them what they need, and Receive is not something this flow can
// carry to completion anyway.
export function EModeGetFundsAction({
  symbol,
  onPress,
}: {
  symbol: string;
  onPress: () => void;
}) {
  const intl = useIntl();

  return (
    <Button
      testID={BorrowTestIDs.eModeNeedActionGetFundsBtn}
      variant="primary"
      flexGrow={1}
      flexShrink={1}
      textEllipsis
      $md={
        {
          size: 'large',
        } as any
      }
      onPress={onPress}
    >
      {`${intl.formatMessage({
        id: ETranslations.global_swap,
      })} ${symbol}`.trim()}
    </Button>
  );
}
