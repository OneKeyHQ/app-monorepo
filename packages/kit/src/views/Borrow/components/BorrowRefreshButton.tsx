import { IconButton } from '@onekeyhq/components';

import { BorrowTestIDs } from '../testIDs';

/**
 * Manual refresh for the whole market. It rides whichever row is on screen —
 * the headline metrics when there are positions, the list heading when there
 * are none — so the two states never show it twice or drop it entirely.
 */
export function BorrowRefreshButton({
  loading,
  onPress,
}: {
  loading?: boolean;
  onPress: () => void;
}) {
  return (
    <IconButton
      testID={BorrowTestIDs.overviewRefreshBtn}
      icon="RefreshCcwOutline"
      variant="tertiary"
      loading={loading}
      onPress={onPress}
    />
  );
}
