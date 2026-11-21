/** @jest-environment jsdom */

import { renderHook } from '@testing-library/react';

import { useDeviceBackNavigation } from './useDeviceBackNavigation';

const mockPop = jest.fn();
const mockDispatch = jest.fn();
const mockAppNavigation = { pop: mockPop, dispatch: mockDispatch };
const mockReactNavigation = {
  getState: jest.fn(),
  isFocused: jest.fn(),
};

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => mockAppNavigation,
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockReactNavigation,
  CommonActions: { reset: jest.fn((params: unknown) => params) },
}));

describe('useDeviceBackNavigation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReactNavigation.isFocused.mockReturnValue(true);
    mockReactNavigation.getState.mockReturnValue({
      index: 1,
      routes: [{ name: 'DeviceList' }, { name: 'DeviceDetail' }],
    });
  });

  it('pops once when the detail screen is focused', () => {
    const { result } = renderHook(() => useDeviceBackNavigation());
    result.current.handleBackPress();
    expect(mockPop).toHaveBeenCalledTimes(1);
  });

  it('ignores a second back request from a screen already on its way out', () => {
    // A removal closes the detail twice: once from its own WalletUpdate
    // refresh and once from the caller that finished the removal. Only the
    // focused call may pop, or the refreshed device list closes with it.
    const { result } = renderHook(() => useDeviceBackNavigation());
    result.current.handleBackPress();
    mockReactNavigation.isFocused.mockReturnValue(false);
    result.current.handleBackPress();
    expect(mockPop).toHaveBeenCalledTimes(1);
  });
});
