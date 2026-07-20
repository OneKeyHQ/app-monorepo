import ServiceSwap from './ServiceSwap';

type IServiceSwapQuoteEventSourceState = {
  _quoteEventSource?: {
    close: jest.Mock;
  };
  _quoteEventSourceSessionId?: string;
};

describe('ServiceSwap quote event source ownership', () => {
  const previousBackgroundScope = globalThis.$onekeyIsInBackground;

  beforeAll(() => {
    globalThis.$onekeyIsInBackground = true;
  });

  afterAll(() => {
    globalThis.$onekeyIsInBackground = previousBackgroundScope;
  });

  it('does not let a stale session cancel the active quote stream', async () => {
    const close = jest.fn();
    const service = new ServiceSwap({ backgroundApi: {} });
    const state = service as unknown as IServiceSwapQuoteEventSourceState;
    state._quoteEventSource = { close };
    state._quoteEventSourceSessionId = 'current-session';

    await service.cancelFetchQuoteEvents({
      quoteEventSessionId: 'stale-session',
    });

    expect(close).not.toHaveBeenCalled();
    expect(state._quoteEventSourceSessionId).toBe('current-session');

    await service.cancelFetchQuoteEvents({
      quoteEventSessionId: 'current-session',
    });

    expect(close).toHaveBeenCalledTimes(1);
    expect(state._quoteEventSourceSessionId).toBeUndefined();
  });

  it('does not let a legacy caller cancel a session-owned quote stream', async () => {
    const close = jest.fn();
    const service = new ServiceSwap({ backgroundApi: {} });
    const state = service as unknown as IServiceSwapQuoteEventSourceState;
    state._quoteEventSource = { close };
    state._quoteEventSourceSessionId = 'current-session';

    await service.cancelFetchQuoteEvents();

    expect(close).not.toHaveBeenCalled();
    expect(state._quoteEventSourceSessionId).toBe('current-session');
  });

  it('lets a legacy caller cancel an unowned quote stream', async () => {
    const close = jest.fn();
    const service = new ServiceSwap({ backgroundApi: {} });
    const state = service as unknown as IServiceSwapQuoteEventSourceState;
    state._quoteEventSource = { close };

    await service.cancelFetchQuoteEvents();

    expect(close).toHaveBeenCalledTimes(1);
  });
});
