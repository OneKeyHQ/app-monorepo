import { useIntl } from 'react-intl';

import type { IButtonProps } from '@onekeyhq/components';
import { Button } from '@onekeyhq/components';
import { BorrowTestIDs } from '@onekeyhq/kit/src/views/Borrow/testIDs';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function EModeGetFundsAction({
  symbol,
  onPress,
  loading,
}: {
  symbol: string;
  onPress: () => void;
  loading?: boolean;
}) {
  const intl = useIntl();

  return (
    <Button
      testID={BorrowTestIDs.eModeNeedActionGetFundsBtn}
      variant="primary"
      loading={loading}
      flexGrow={1}
      flexShrink={1}
      textEllipsis
      $md={
        {
          size: 'large',
          // Split the footer evenly with the blocked action, the same way
          // Page.Footer's own confirm does. Only under $md: above it the
          // button container is content-sized (ml: auto in a row), and
          // basis-0 children there share the sum of their content widths
          // equally instead, which truncates the longer label.
          flexBasis: 0,
        } as IButtonProps
      }
      onPress={onPress}
    >
      {`${intl.formatMessage({
        id: ETranslations.global_swap,
      })} ${symbol}`.trim()}
    </Button>
  );
}
