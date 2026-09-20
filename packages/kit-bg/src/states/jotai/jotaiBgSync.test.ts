/* eslint-disable import/first */

const mockUiAtomWriteCensus = jest.fn();

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    app: {
      perf: {
        uiAtomWriteCensus: (params: unknown) => {
          mockUiAtomWriteCensus(params);
        },
      },
    },
  },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isExtensionUi: true },
}));

jest.mock('./jotaiInitFromUi', () => ({ jotaiInitFromUi: jest.fn() }));

import { EAtomNames } from './atomNames';
import { JotaiBgSync } from './jotaiBgSync';

describe('JotaiBgSync UI atom write census', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockUiAtomWriteCensus.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('reports one aggregated line per window, busiest atoms first', () => {
    const setAtomValue = jest.fn();
    const sync = new JotaiBgSync();
    sync.setBackgroundApi({ setAtomValue } as unknown as Parameters<
      JotaiBgSync['setBackgroundApi']
    >[0]);

    for (let index = 0; index < 3; index += 1) {
      void sync.proxyStateUpdateActionFromUiToBg({
        name: EAtomNames.jotaiContextStoreMapAtom,
        payload: index,
      });
    }
    void sync.proxyStateUpdateActionFromUiToBg({
      name: EAtomNames.settingsPersistAtom,
      payload: {},
    });

    expect(setAtomValue).toHaveBeenCalledTimes(4);
    expect(mockUiAtomWriteCensus).not.toHaveBeenCalled();

    jest.advanceTimersByTime(30_000);

    expect(mockUiAtomWriteCensus).toHaveBeenCalledTimes(1);
    expect(mockUiAtomWriteCensus).toHaveBeenCalledWith({
      windowMs: 30_000,
      total: 4,
      atomCount: 2,
      byAtom: [
        { atom: EAtomNames.jotaiContextStoreMapAtom, count: 3 },
        { atom: EAtomNames.settingsPersistAtom, count: 1 },
      ],
    });

    // A quiet window stays silent and leaves no timer behind.
    jest.advanceTimersByTime(60_000);
    expect(mockUiAtomWriteCensus).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });
});
