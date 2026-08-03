import { StrictMode } from 'react';

import { type ReactTestRenderer, act, create } from 'react-test-renderer';

import type { INativeBackgroundThreadReadySignal } from '@onekeyhq/kit-bg/src/apis/BackgroundApiProxyBase';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorStorageInit } from './AccountSelectorStorageInit';

const mockInitFromStorage = jest.fn(() => Promise.resolve());
type ISubscribeReady = (
  listener: (signal: INativeBackgroundThreadReadySignal) => void,
) => (() => void) | undefined;
const mockSubscribeReady: jest.MockedFunction<ISubscribeReady> = jest.fn();
type IPublishRecoveryParams = {
  owner: {
    sceneName: EAccountSelectorSceneName;
    sceneUrl?: string;
  };
  readySignal: INativeBackgroundThreadReadySignal;
};
const mockPublishRecovery = jest.fn<void, [IPublishRecoveryParams]>();
const mockMarkRawReady = jest.fn<void, [IPublishRecoveryParams]>();
const mockIsRawReadyCurrent = jest.fn<
  boolean,
  [
    {
      owner: IPublishRecoveryParams['owner'];
      sequence: number;
    },
  ]
>();
const mockTestGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};
let mockSceneName = EAccountSelectorSceneName.home;
const mockLatestRawReadySequenceByOwner = new Map<string, number>();

function getMockOwnerKey(owner: IPublishRecoveryParams['owner']) {
  return `${owner.sceneName}:${owner.sceneUrl ?? ''}`;
}

function createDeferred() {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

jest.mock('../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    subscribeNativeBackgroundThreadReady: (
      listener: (signal: INativeBackgroundThreadReadySignal) => void,
    ) => mockSubscribeReady(listener),
  },
}));

jest.mock('./accountSelectorBackgroundRecovery', () => ({
  isAccountSelectorBackgroundRecoveryRawReadySequenceCurrent: (params: {
    owner: IPublishRecoveryParams['owner'];
    sequence: number;
  }) => mockIsRawReadyCurrent(params),
  markAccountSelectorBackgroundRecoveryRawReady: (
    params: IPublishRecoveryParams,
  ) => {
    mockMarkRawReady(params);
  },
  publishAccountSelectorBackgroundRecoveryComplete: (
    params: IPublishRecoveryParams,
  ) => {
    mockPublishRecovery(params);
  },
}));

jest.mock('../../states/jotai/contexts/accountSelector', () => ({
  useAccountSelectorSceneInfo: () => ({
    sceneName: mockSceneName,
    sceneUrl: undefined,
  }),
}));

jest.mock('../../states/jotai/contexts/accountSelector/actions', () => ({
  useAccountSelectorActions: () => ({
    current: {
      initFromStorage: mockInitFromStorage,
    },
  }),
}));

function signal(
  bootId: string,
  reason: INativeBackgroundThreadReadySignal['reason'],
  sequence: number,
): INativeBackgroundThreadReadySignal {
  return {
    bootId,
    reason,
    sequence,
  };
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('AccountSelectorStorageInit native background recovery', () => {
  let renderer: ReactTestRenderer | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    mockInitFromStorage.mockImplementation(() => Promise.resolve());
    mockTestGlobal.IS_REACT_ACT_ENVIRONMENT = true;
    mockSceneName = EAccountSelectorSceneName.home;
    mockLatestRawReadySequenceByOwner.clear();
    mockMarkRawReady.mockImplementation(({ owner, readySignal }) => {
      const ownerKey = getMockOwnerKey(owner);
      const latestRawReadySequence =
        mockLatestRawReadySequenceByOwner.get(ownerKey);
      if (
        latestRawReadySequence === undefined ||
        readySignal.sequence > latestRawReadySequence
      ) {
        mockLatestRawReadySequenceByOwner.set(ownerKey, readySignal.sequence);
      }
    });
    mockIsRawReadyCurrent.mockImplementation(
      ({ owner, sequence }) =>
        mockLatestRawReadySequenceByOwner.get(getMockOwnerKey(owner)) ===
        sequence,
    );
  });

  afterEach(() => {
    act(() => {
      renderer?.unmount();
    });
    renderer = undefined;
    delete mockTestGlobal.IS_REACT_ACT_ENVIRONMENT;
  });

  it('keeps mount-time initialization for runtimes without a ready subscription', async () => {
    mockSubscribeReady.mockReturnValue(undefined);

    await act(async () => {
      renderer = create(<AccountSelectorStorageInit />);
    });
    await flushPromises();

    expect(mockInitFromStorage).toHaveBeenCalledTimes(1);
    expect(mockInitFromStorage).toHaveBeenCalledWith({
      sceneName: EAccountSelectorSceneName.home,
      sceneUrl: undefined,
    });
    expect(mockPublishRecovery).not.toHaveBeenCalled();
    expect(mockMarkRawReady).not.toHaveBeenCalled();
  });

  it('waits for native ready and deduplicates an exact signal replay', async () => {
    let listener:
      | ((value: INativeBackgroundThreadReadySignal) => void)
      | undefined;
    const unsubscribe = jest.fn();
    mockSubscribeReady.mockImplementation(
      (nextListener: (signal: INativeBackgroundThreadReadySignal) => void) => {
        listener = nextListener;
        return unsubscribe;
      },
    );

    await act(async () => {
      renderer = create(<AccountSelectorStorageInit />);
    });
    expect(mockInitFromStorage).not.toHaveBeenCalled();

    act(() => {
      listener?.(signal('boot-1', 'initial', 1));
      listener?.(signal('boot-1', 'initial', 1));
    });
    await flushPromises();
    expect(mockInitFromStorage).toHaveBeenCalledTimes(1);
    expect(mockMarkRawReady).toHaveBeenCalledTimes(2);
    expect(mockPublishRecovery).toHaveBeenCalledTimes(1);
    expect(mockPublishRecovery).toHaveBeenLastCalledWith({
      owner: {
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: undefined,
      },
      readySignal: signal('boot-1', 'initial', 1),
    });

    act(() => {
      listener?.(signal('boot-1', 'recovered', 2));
      listener?.(signal('boot-1', 'recovered', 2));
    });
    await flushPromises();

    expect(mockInitFromStorage).toHaveBeenCalledTimes(2);
    expect(mockMarkRawReady).toHaveBeenCalledTimes(4);
    expect(mockPublishRecovery).toHaveBeenCalledTimes(2);
    expect(mockPublishRecovery).toHaveBeenLastCalledWith({
      owner: {
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: undefined,
      },
      readySignal: signal('boot-1', 'recovered', 2),
    });

    act(() => {
      listener?.(signal('boot-2', 'restarted', 3));
    });
    await flushPromises();

    expect(mockInitFromStorage).toHaveBeenCalledTimes(3);
    expect(mockMarkRawReady).toHaveBeenCalledTimes(5);
    expect(mockPublishRecovery).toHaveBeenCalledTimes(3);

    act(() => {
      renderer?.unmount();
    });
    renderer = undefined;
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('handles a recovered signal replayed during subscription', async () => {
    mockSubscribeReady.mockImplementation(
      (listener: (signal: INativeBackgroundThreadReadySignal) => void) => {
        listener(signal('boot-recovered', 'recovered', 5));
        return jest.fn();
      },
    );

    await act(async () => {
      renderer = create(<AccountSelectorStorageInit />);
    });
    await flushPromises();

    expect(mockInitFromStorage).toHaveBeenCalledTimes(1);
    expect(mockPublishRecovery).toHaveBeenCalledWith({
      owner: {
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: undefined,
      },
      readySignal: signal('boot-recovered', 'recovered', 5),
    });
  });

  it('publishes completion only to the matching account-selector owner', async () => {
    mockSceneName = EAccountSelectorSceneName.swap;
    mockSubscribeReady.mockImplementation(
      (listener: (signal: INativeBackgroundThreadReadySignal) => void) => {
        listener(signal('boot-swap', 'recovered', 8));
        return jest.fn();
      },
    );

    await act(async () => {
      renderer = create(<AccountSelectorStorageInit />);
    });
    await flushPromises();

    expect(mockInitFromStorage).toHaveBeenCalledTimes(1);
    expect(mockPublishRecovery).toHaveBeenCalledWith({
      owner: {
        sceneName: EAccountSelectorSceneName.swap,
        sceneUrl: undefined,
      },
      readySignal: signal('boot-swap', 'recovered', 8),
    });
  });

  it.each(['recovered', 'restarted'] as const)(
    'lets the active StrictMode effect commit a late %s replay exactly once',
    async (reason) => {
      const initDeferred = createDeferred();
      const replayedSignal = signal(`boot-strict-${reason}`, reason, 20);
      const unsubscribe = jest.fn();
      mockInitFromStorage.mockImplementation(() => initDeferred.promise);
      mockSubscribeReady.mockImplementation(
        (listener: (signal: INativeBackgroundThreadReadySignal) => void) => {
          listener(replayedSignal);
          return unsubscribe;
        },
      );

      await act(async () => {
        renderer = create(
          <StrictMode>
            <AccountSelectorStorageInit />
          </StrictMode>,
        );
        await Promise.resolve();
      });

      expect(mockSubscribeReady).toHaveBeenCalledTimes(2);
      expect(mockInitFromStorage).toHaveBeenCalledTimes(1);
      expect(mockPublishRecovery).not.toHaveBeenCalled();

      await act(async () => {
        initDeferred.resolve();
        await initDeferred.promise;
        await Promise.resolve();
      });

      expect(mockInitFromStorage).toHaveBeenCalledTimes(1);
      expect(mockPublishRecovery).toHaveBeenCalledTimes(1);
      expect(mockPublishRecovery).toHaveBeenCalledWith({
        owner: {
          sceneName: EAccountSelectorSceneName.home,
          sceneUrl: undefined,
        },
        readySignal: replayedSignal,
      });
    },
  );

  it('suppresses sequence N completion when raw N+1 arrives before init finishes', async () => {
    const initN = createDeferred();
    const initN1 = createDeferred();
    let listener:
      | ((value: INativeBackgroundThreadReadySignal) => void)
      | undefined;
    mockInitFromStorage
      .mockImplementationOnce(() => initN.promise)
      .mockImplementationOnce(() => initN1.promise);
    mockSubscribeReady.mockImplementation(
      (nextListener: (signal: INativeBackgroundThreadReadySignal) => void) => {
        listener = nextListener;
        return jest.fn();
      },
    );

    await act(async () => {
      renderer = create(<AccountSelectorStorageInit />);
    });
    act(() => {
      listener?.(signal('boot-overlap', 'recovered', 40));
    });
    await flushPromises();
    expect(mockInitFromStorage).toHaveBeenCalledTimes(1);

    act(() => {
      listener?.(signal('boot-overlap', 'restarted', 41));
    });
    expect(mockMarkRawReady).toHaveBeenLastCalledWith({
      owner: {
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: undefined,
      },
      readySignal: signal('boot-overlap', 'restarted', 41),
    });

    await act(async () => {
      initN.resolve();
      await initN.promise;
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockInitFromStorage).toHaveBeenCalledTimes(2);
    expect(mockPublishRecovery).not.toHaveBeenCalled();

    await act(async () => {
      initN1.resolve();
      await initN1.promise;
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mockPublishRecovery).toHaveBeenCalledTimes(1);
    expect(mockPublishRecovery).toHaveBeenCalledWith({
      owner: {
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: undefined,
      },
      readySignal: signal('boot-overlap', 'restarted', 41),
    });
  });

  it('drops an old owner completion and supports A -> B -> A ownership', async () => {
    const initOwnerA = createDeferred();
    const listeners: ((signal: INativeBackgroundThreadReadySignal) => void)[] =
      [];
    mockInitFromStorage
      .mockImplementationOnce(() => initOwnerA.promise)
      .mockImplementation(() => Promise.resolve());
    mockSubscribeReady.mockImplementation(
      (listener: (signal: INativeBackgroundThreadReadySignal) => void) => {
        listeners.push(listener);
        return jest.fn();
      },
    );

    await act(async () => {
      renderer = create(<AccountSelectorStorageInit />);
    });
    act(() => {
      listeners[0]?.(signal('boot-owner-a', 'recovered', 30));
    });
    await flushPromises();

    mockSceneName = EAccountSelectorSceneName.swap;
    await act(async () => {
      renderer?.update(<AccountSelectorStorageInit />);
    });
    act(() => {
      listeners[1]?.(signal('boot-owner-b', 'recovered', 31));
    });
    await act(async () => {
      initOwnerA.resolve();
      await initOwnerA.promise;
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockPublishRecovery).toHaveBeenCalledTimes(1);
    expect(mockPublishRecovery).toHaveBeenLastCalledWith({
      owner: {
        sceneName: EAccountSelectorSceneName.swap,
        sceneUrl: undefined,
      },
      readySignal: signal('boot-owner-b', 'recovered', 31),
    });
    expect(mockInitFromStorage).toHaveBeenCalledTimes(2);

    mockSceneName = EAccountSelectorSceneName.home;
    await act(async () => {
      renderer?.update(<AccountSelectorStorageInit />);
    });
    act(() => {
      listeners[2]?.(signal('boot-owner-a', 'recovered', 30));
    });
    await flushPromises();

    expect(mockPublishRecovery).toHaveBeenCalledTimes(2);
    expect(mockPublishRecovery).toHaveBeenLastCalledWith({
      owner: {
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: undefined,
      },
      readySignal: signal('boot-owner-a', 'recovered', 30),
    });
    expect(mockInitFromStorage).toHaveBeenCalledTimes(3);
    expect(mockInitFromStorage).toHaveBeenLastCalledWith({
      sceneName: EAccountSelectorSceneName.home,
      sceneUrl: undefined,
    });
  });
});
