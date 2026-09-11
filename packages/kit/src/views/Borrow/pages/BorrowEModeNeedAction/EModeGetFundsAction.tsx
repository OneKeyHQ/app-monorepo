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
      // Split the footer evenly with the blocked action.
      flexBasis={0}
      textEllipsis
      $md={
        {
          size: 'large',
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
