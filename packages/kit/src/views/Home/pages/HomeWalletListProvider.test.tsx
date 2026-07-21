import { StrictMode } from 'react';

import { type ReactTestRenderer, act, create } from 'react-test-renderer';

import {
  HomeWalletListProvider,
  useHomeWalletList,
} from './HomeWalletListProvider';

type IGetWalletsParams = {
  ignoreEmptySingletonWalletAccounts: boolean;
};
type IWalletListResult = {
  wallets: { id: string }[];
};
const mockGetWallets = jest.fn<Promise<IWalletListResult>, [IGetWalletsParams]>(
  () => Promise.resolve({ wallets: [{ id: 'wallet-1' }] }),
);
const mockTestGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};
let observedPending = true;
let observedSurface = 'pending';
let observedWalletIds: string[] = [];
let observedRefreshSilently: (() => Promise<void>) | undefined;

function createDeferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: {
      getWallets: (params: IGetWalletsParams) => mockGetWallets(params),
    },
  },
}));

function Probe() {
  const { pending, refreshSilently, result } = useHomeWalletList();
  observedPending = pending;
  observedSurface = pending ? 'pending' : 'confirmed';
  observedWalletIds = result?.wallets.map((wallet) => wallet.id) ?? [];
  observedRefreshSilently = refreshSilently;
  return null;
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('HomeWalletListProvider refresh ownership', () => {
  let renderer: ReactTestRenderer | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetWallets.mockImplementation(() =>
      Promise.resolve({ wallets: [{ id: 'wallet-1' }] }),
    );
    observedPending = true;
    observedSurface = 'pending';
    observedWalletIds = [];
    observedRefreshSilently = undefined;
    mockTestGlobal.IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    act(() => {
      renderer?.unmount();
    });
    renderer = undefined;
    delete mockTestGlobal.IS_REACT_ACT_ENVIRONMENT;
  });

  it('exposes a silent refresh that does not change its confirmed surface', async () => {
    await act(async () => {
      renderer = create(
        <StrictMode>
          <HomeWalletListProvider>
            <Probe />
          </HomeWalletListProvider>
        </StrictMode>,
      );
    });
    await flushPromises();
    expect(observedPending).toBe(false);
    expect(observedSurface).toBe('confirmed');
    expect(observedWalletIds).toEqual(['wallet-1']);
    const initialRefreshCount = mockGetWallets.mock.calls.length;

    const recoveryRequest = createDeferred<IWalletListResult>();
    mockGetWallets.mockImplementationOnce(() => recoveryRequest.promise);
    await act(async () => {
      void observedRefreshSilently?.();
      await Promise.resolve();
    });
    expect(mockGetWallets).toHaveBeenCalledTimes(initialRefreshCount + 1);
    expect(observedPending).toBe(false);
    expect(observedSurface).toBe('confirmed');
    expect(observedWalletIds).toEqual(['wallet-1']);

    await act(async () => {
      recoveryRequest.resolve({ wallets: [{ id: 'wallet-2' }] });
      await recoveryRequest.promise;
    });
    expect(observedPending).toBe(false);
    expect(observedSurface).toBe('confirmed');
    expect(observedWalletIds).toEqual(['wallet-2']);
  });
});
