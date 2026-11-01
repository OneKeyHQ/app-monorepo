import type { IGlobalStatesSyncBroadcastParams } from '@onekeyhq/shared/src/background/backgroundUtils';

const mockJotaiUpdateFromUiByBgBroadcast = jest.fn<
  Promise<void>,
  [IGlobalStatesSyncBroadcastParams]
>(async () => undefined);

jest.mock('@onekeyhq/kit-bg/src/states/jotai/jotaiInitFromUi', () => ({
  jotaiUpdateFromUiByBgBroadcast: (params: IGlobalStatesSyncBroadcastParams) =>
    mockJotaiUpdateFromUiByBgBroadcast(params),
}));

const { applyOrQueueJotaiStateBroadcast, runJotaiMainHydration } =
  require('./jotaiMainHydrationGate') as typeof import('./jotaiMainHydrationGate');

function createDeferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

describe('jotai main hydration gate', () => {
  beforeEach(() => {
    mockJotaiUpdateFromUiByBgBroadcast.mockReset();
    mockJotaiUpdateFromUiByBgBroadcast.mockResolvedValue(undefined);
  });

  it('replays a newer broadcast after the startup snapshot', async () => {
    const initialization = createDeferred();
    const applicationOrder: string[] = [];
    mockJotaiUpdateFromUiByBgBroadcast.mockImplementation(async (params) => {
      applicationOrder.push(`broadcast:${String(params.payload)}`);
    });

    const hydrationPromise = runJotaiMainHydration(async () => {
      await initialization.promise;
      applicationOrder.push('snapshot:old');
    });

    applyOrQueueJotaiStateBroadcast({
      name: 'testAtom',
      payload: 'new',
    });
    expect(mockJotaiUpdateFromUiByBgBroadcast).not.toHaveBeenCalled();

    initialization.resolve();
    await hydrationPromise;

    expect(applicationOrder).toEqual(['snapshot:old', 'broadcast:new']);
  });

  it('keeps ordered broadcasts buffered until replay fully drains', async () => {
    const initialization = createDeferred();
    const firstBroadcast = createDeferred();
    const applicationOrder: string[] = [];
    mockJotaiUpdateFromUiByBgBroadcast.mockImplementation(async (params) => {
      const payload = String(params.payload);
      applicationOrder.push(payload);
      if (payload === 'first') {
        await firstBroadcast.promise;
      }
    });

    const hydrationPromise = runJotaiMainHydration(
      () => initialization.promise,
    );
    applyOrQueueJotaiStateBroadcast({ name: 'firstAtom', payload: 'first' });
    applyOrQueueJotaiStateBroadcast({ name: 'secondAtom', payload: 'second' });

    initialization.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(applicationOrder).toEqual(['first']);

    applyOrQueueJotaiStateBroadcast({ name: 'thirdAtom', payload: 'third' });
    firstBroadcast.resolve();
    await hydrationPromise;

    expect(applicationOrder).toEqual(['first', 'second', 'third']);
  });

  it('drops failed-attempt broadcasts and uses a fresh snapshot on retry', async () => {
    const firstInitialization = createDeferred();
    const firstHydrationPromise = runJotaiMainHydration(
      () => firstInitialization.promise,
    );
    applyOrQueueJotaiStateBroadcast({ name: 'testAtom', payload: 'stale' });

    firstInitialization.reject(new Error('snapshot failed'));
    await expect(firstHydrationPromise).rejects.toThrow('snapshot failed');
    applyOrQueueJotaiStateBroadcast({
      name: 'testAtom',
      payload: 'while-waiting',
    });

    const retryInitialization = createDeferred();
    const retryHydrationPromise = runJotaiMainHydration(
      () => retryInitialization.promise,
    );
    applyOrQueueJotaiStateBroadcast({ name: 'testAtom', payload: 'fresh' });
    retryInitialization.resolve();
    await retryHydrationPromise;

    expect(mockJotaiUpdateFromUiByBgBroadcast).toHaveBeenCalledTimes(1);
    expect(mockJotaiUpdateFromUiByBgBroadcast).toHaveBeenCalledWith({
      $$isFromBgStatesSyncBroadcast: true,
      name: 'testAtom',
      payload: 'fresh',
    });
  });
});
