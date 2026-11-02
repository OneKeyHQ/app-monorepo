/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import { useMarketDetailPositionTab } from './useMarketDetailPositionTab';

let mockPreferPosition = false;
const mockSetPreference = jest.fn(
  ({ preferPosition }: { preferPosition: boolean }) => {
    mockPreferPosition = preferPosition;
  },
);

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useMarketDetailPositionTabPersistAtom: () => [
    { preferPosition: mockPreferPosition },
    mockSetPreference,
  ],
}));

describe('useMarketDetailPositionTab', () => {
  beforeEach(() => {
    mockPreferPosition = false;
    mockSetPreference.mockClear();
  });

  it('opens on the default tab until My position is picked', () => {
    const { result } = renderHook(() => useMarketDetailPositionTab());

    expect(result.current.preferPosition).toBe(false);
  });

  it('remembers My position once the user picks it', () => {
    const { result, rerender } = renderHook(() => useMarketDetailPositionTab());

    act(() => result.current.recordTabChange(true));
    rerender();

    expect(mockSetPreference).toHaveBeenLastCalledWith({
      preferPosition: true,
    });
    expect(result.current.preferPosition).toBe(true);
  });

  it('forgets My position when the user picks any other tab', () => {
    mockPreferPosition = true;
    const { result, rerender } = renderHook(() => useMarketDetailPositionTab());

    act(() => result.current.recordTabChange(false));
    rerender();

    expect(mockSetPreference).toHaveBeenLastCalledWith({
      preferPosition: false,
    });
    expect(result.current.preferPosition).toBe(false);
  });
});
