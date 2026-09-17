/**
 * @jest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react';

import { Haptics } from '@onekeyhq/components';

import { useUnifiedNetworkSelectorTrigger } from './useUnifiedNetworkSelectorTrigger';

const mockShowUnifiedNetworkSelector = jest.fn();
const mockNavigation = {};

jest.mock('@onekeyhq/components', () => ({
  Haptics: {
    selection: jest.fn(),
  },
}));

jest.mock('../../../hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => mockNavigation,
}));

jest.mock('../../../states/jotai/contexts/accountSelector', () => ({
  useAccountSelectorSceneInfo: () => ({
    sceneName: 'home',
    sceneUrl: undefined,
  }),
  useActiveAccount: () => ({ activeAccount: {} }),
}));

jest.mock('../../../states/jotai/contexts/accountSelector/actions', () => ({
  useAccountSelectorActions: () => ({
    current: {
      showUnifiedNetworkSelector: mockShowUnifiedNetworkSelector,
    },
  }),
}));

jest.mock('./useAccountSelectorAvailableNetworks', () => ({
  useAccountSelectorAvailableNetworks: () => ({
    networkIds: ['network-1'],
    defaultNetworkId: 'network-1',
  }),
}));

describe('useUnifiedNetworkSelectorTrigger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('emits selection feedback when opening the network selector', () => {
    const { result } = renderHook(() =>
      useUnifiedNetworkSelectorTrigger({ num: 0 }),
    );

    act(() => {
      result.current.showUnifiedNetworkSelector();
    });

    expect(Haptics.selection).toHaveBeenCalledTimes(1);
    expect(mockShowUnifiedNetworkSelector).toHaveBeenCalledTimes(1);
  });
});
