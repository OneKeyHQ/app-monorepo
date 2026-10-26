import type { IKeyOfIcons } from '@onekeyhq/components';

import { SwapTestIDs } from '../testIDs';

export interface ISwapBalanceActionProps {
  onPress?: () => void;
  actionIconName?: IKeyOfIcons;
  actionLoading: boolean;
  testID?: string;
}

// The balance row's trailing control: Max while there is something to max
// out, a refresh action (spinning while it reloads) once the balance is a
// loaded zero. Shared by the Swap From row and the Stocks Pay row so the icon,
// test ids and loading rule stay identical.
export function getSwapBalanceActionProps({
  isLoadedZero,
  refreshing,
  onRefresh,
  onMax,
}: {
  isLoadedZero: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onMax?: () => void;
}): ISwapBalanceActionProps {
  if (isLoadedZero) {
    return {
      onPress: onRefresh,
      actionIconName: 'RefreshCcwOutline',
      actionLoading: refreshing,
      testID: SwapTestIDs.balanceRefreshButton,
    };
  }
  return {
    onPress: onMax,
    actionIconName: undefined,
    actionLoading: false,
    testID: onMax ? SwapTestIDs.maxButton : undefined,
  };
}
