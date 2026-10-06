import { SwapTestIDs } from '../testIDs';

import { getSwapBalanceActionProps } from './swapBalanceActionUtils';

describe('getSwapBalanceActionProps', () => {
  const onRefresh = jest.fn();
  const onMax = jest.fn();

  it('offers Max while the balance is not a loaded zero', () => {
    expect(
      getSwapBalanceActionProps({
        isLoadedZero: false,
        refreshing: true,
        onRefresh,
        onMax,
      }),
    ).toEqual({
      onPress: onMax,
      actionIconName: undefined,
      actionLoading: false,
      testID: SwapTestIDs.maxButton,
    });
  });

  it('turns Max into a refresh action at a loaded zero', () => {
    expect(
      getSwapBalanceActionProps({
        isLoadedZero: true,
        refreshing: true,
        onRefresh,
        onMax,
      }),
    ).toEqual({
      onPress: onRefresh,
      actionIconName: 'RefreshCcwOutline',
      actionLoading: true,
      testID: SwapTestIDs.balanceRefreshButton,
    });
  });

  it('leaves the control inert while Max is not available', () => {
    expect(
      getSwapBalanceActionProps({
        isLoadedZero: false,
        refreshing: false,
        onRefresh,
        onMax: undefined,
      }),
    ).toEqual({
      onPress: undefined,
      actionIconName: undefined,
      actionLoading: false,
      testID: undefined,
    });
  });
});
