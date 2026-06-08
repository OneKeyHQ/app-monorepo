/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, renderHook } from '@testing-library/react';
import { createStore } from 'jotai';

import { useEarnActions } from './actions';
import {
  ProviderJotaiContextEarn,
  basicEarnAtom,
  earnStorageReadyAtom,
  useEarnAtom,
} from './atoms';

type IGetEarnData = () => Promise<Record<string, never>>;
type ISetRawData = (payload: Record<string, unknown>) => void;

const mockGetEarnData: jest.MockedFunction<IGetEarnData> = jest.fn(
  async () => ({}),
);
const mockSetRawData: jest.MockedFunction<ISetRawData> = jest.fn();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    simpleDb: {
      earn: {
        getEarnData: () => mockGetEarnData(),
        setRawData: (payload: Record<string, unknown>) =>
          mockSetRawData(payload),
      },
    },
  },
}));

function createWrapper() {
  const store = createStore();
  store.set(earnStorageReadyAtom(), true);
  store.set(basicEarnAtom(), {
    earnAccount: {},
    availableAssetsByType: {},
    recommendedTokens: [],
    refreshTrigger: 0,
  });

  return function Wrapper({ children }: { children?: ReactNode }) {
    return (
      <ProviderJotaiContextEarn store={store}>
        {children}
      </ProviderJotaiContextEarn>
    );
  };
}

describe('useEarnActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('increments the available-assets refresh trigger when triggerRefresh runs', async () => {
    const { result } = renderHook(
      () => {
        const actions = useEarnActions().current;
        const [earnState] = useEarnAtom();

        return {
          actions,
          earnState,
        };
      },
      {
        wrapper: createWrapper(),
      },
    );

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.actions.triggerRefresh();
    });

    expect(result.current.earnState.refreshTrigger).toBe(1);
    expect(mockSetRawData).toHaveBeenCalledWith(
      expect.objectContaining({
        refreshTrigger: 1,
      }),
    );
  });
});
