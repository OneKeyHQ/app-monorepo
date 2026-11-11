import { createMessengerApi } from './messengerApi';
import { uploadIntercomImage } from './upload';

jest.mock('../../errors', () => ({ OneKeyLocalError: Error }));

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

it('uploads a browser image using multipart bytes without credentials or redirects', async () => {
  const fetchMock = jest.fn(
    async (_url: string | URL | Request, _options?: RequestInit) =>
      new Response(null, { status: 201 }),
  );
  globalThis.fetch = fetchMock;
  const blob = new Blob(['test image'], { type: 'image/png' });
  const result = await uploadIntercomImage(
    createMessengerApi({
      request: async () => ({
        upload_destination: 'https://uploads.intercomcdn.com/',
        public_url: 'https://downloads.intercomcdn.com/image.png',
        policy: 'test-policy',
        key: 'image.png',
      }),
      assertCurrent: async () => {},
    }),
    {
      path: 'blob:test-image',
      filename: 'image.png',
      mime: 'image/png',
      size: blob.size,
      width: 1,
      height: 1,
      blob,
    },
    new AbortController().signal,
  );
  expect(result.url).toBe('https://downloads.intercomcdn.com/image.png');
  const options = fetchMock.mock.calls[0][1];
  expect(options).toMatchObject({ credentials: 'omit', redirect: 'error' });
  const form = options?.body as FormData;
  expect(form.get('policy')).toBe('test-policy');
  expect(await (form.get('file') as Blob).text()).toBe('test image');
});

it.each(['timeout', 'cancel', 'already-cancelled'] as const)(
  'aborts a stalled upload on %s without retrying and cleans its timer',
  async (reason) => {
    jest.useFakeTimers();
    const controller = new AbortController();
    const blob = new Blob(['test image'], { type: 'image/png' });
    const fetchMock = jest.fn(
      async (_url: string | URL | Request, options?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          const abort = () => reject(new Error('upload aborted'));
          if (options?.signal?.aborted) abort();
          else
            options?.signal?.addEventListener('abort', abort, { once: true });
        }),
    );
    globalThis.fetch = fetchMock;
    if (reason === 'already-cancelled') controller.abort();
    const result = uploadIntercomImage(
      {
        getUploadMetadata: async () => ({
          destination: 'https://uploads.intercomcdn.com/',
          publicUrl: 'https://downloads.intercomcdn.com/test.png',
          fields: {},
        }),
        assertCurrent: async () => {},
      },
      {
        path: 'blob:test',
        mime: 'image/png',
        filename: 'test.png',
        size: blob.size,
        width: 1,
        height: 1,
        blob,
      },
      controller.signal,
    );
    const outcome = result.catch((error: unknown) => error);
    await jest.advanceTimersByTimeAsync(0);
    if (reason === 'timeout') {
      await jest.advanceTimersByTimeAsync(59_999);
      expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(false);
      await jest.advanceTimersByTimeAsync(1);
    } else controller.abort();
    expect(await outcome).toEqual(new Error('upload aborted'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
    jest.useRealTimers();
  },
);
