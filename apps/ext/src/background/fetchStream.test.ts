import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { FETCH_STREAM_MESSAGE } from '@onekeyhq/shared/types/fetchStream';
import type {
  IFetchStreamRequest,
  IFetchStreamResult,
} from '@onekeyhq/shared/types/fetchStream';

import { installFetchStreamListener } from './fetchStream';

type IListener = (
  message: { type?: string; request?: IFetchStreamRequest },
  sender: { id?: string; tab?: { id: number } },
  sendResponse: (response: IFetchStreamResult) => void,
) => boolean | undefined;

const addListener = jest.fn<void, [IListener]>();
const globals = globalThis as unknown as {
  chrome?: {
    runtime: { id: string; onMessage: { addListener: typeof addListener } };
  };
};
const savedChrome = globals.chrome;
const savedFetch = globalThis.fetch;
let listener: IListener;

beforeEach(() => {
  addListener.mockClear();
  globals.chrome = {
    runtime: { id: 'own-extension', onMessage: { addListener } },
  };
  installFetchStreamListener();
  [listener] = addListener.mock.calls[0];
});

afterEach(() => {
  globals.chrome = savedChrome;
  jest.restoreAllMocks();
  globalThis.fetch = savedFetch;
});

const message = {
  type: FETCH_STREAM_MESSAGE,
  request: {
    action: 'open',
    url: 'https://example.test/download',
    headers: [],
  } as IFetchStreamRequest,
};

it.each([{ id: 'other-extension' }, { id: 'own-extension', tab: { id: 1 } }])(
  'rejects an untrusted sender before any network request: %j',
  (sender) => {
    const fetchImpl = jest.spyOn(globalThis, 'fetch');
    const reply = jest.fn();
    expect(listener(message, sender, reply)).toBeUndefined();
    expect(reply).toHaveBeenCalledWith({ ok: false, error: 'not allowed' });
    expect(fetchImpl).not.toHaveBeenCalled();
  },
);

it('leaves unrelated messages to their existing listeners', () => {
  const reply = jest.fn();
  expect(
    listener(
      { type: 'privacyChain/nodeRequest' },
      { id: 'own-extension' },
      reply,
    ),
  ).toBeUndefined();
  expect(reply).not.toHaveBeenCalled();
});

it('rejects a missing stream request', () => {
  const reply = jest.fn();
  expect(
    listener({ type: FETCH_STREAM_MESSAGE }, { id: 'own-extension' }, reply),
  ).toBeUndefined();
  expect(reply).toHaveBeenCalledWith({
    ok: false,
    error: 'missing fetch stream request',
  });
});

it('keeps the reply channel open and releases the trusted host stream on cancel', async () => {
  const fetchImpl = jest.fn(async () => new Response('ok'));
  globalThis.fetch = fetchImpl;
  const sender = { id: 'own-extension' };
  const opened = await new Promise<IFetchStreamResult>((resolve) => {
    expect(listener(message, sender, resolve)).toBe(true);
  });
  if (!opened.ok || !('response' in opened))
    throw new OneKeyLocalError('open failed');
  expect(opened.response.status).toBe(200);
  expect(fetchImpl).toHaveBeenCalledWith(
    'https://example.test/download',
    expect.objectContaining({ method: 'GET' }),
  );
  const cancelled = await new Promise<IFetchStreamResult>((resolve) => {
    expect(
      listener(
        {
          type: FETCH_STREAM_MESSAGE,
          request: { action: 'cancel', id: opened.response.id },
        },
        sender,
        resolve,
      ),
    ).toBe(true);
  });
  expect(cancelled).toEqual({ ok: true, cancelled: true });
});
