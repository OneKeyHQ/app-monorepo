import { THEME_PRELOAD_STORAGE_KEY, updateRootViewBackgroundColor } from '.';

import resetUtils from '@onekeyhq/shared/src/utils/resetUtils';

describe('updateRootViewBackgroundColor reset fence', () => {
  afterEach(() => {
    while (resetUtils.getIsResetting()) {
      resetUtils.endResetting();
    }
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('drains a scheduled theme write without letting it cross reset', async () => {
    jest.useFakeTimers();
    const setItem = jest.spyOn(globalThis.localStorage, 'setItem');

    updateRootViewBackgroundColor('#000', 'dark');
    resetUtils.startResetting();
    const drain = resetUtils.waitForResetSensitiveTasksToSettle();
    jest.advanceTimersByTime(0);
    await drain;

    expect(setItem).not.toHaveBeenCalledWith(THEME_PRELOAD_STORAGE_KEY, 'dark');
  });
});
