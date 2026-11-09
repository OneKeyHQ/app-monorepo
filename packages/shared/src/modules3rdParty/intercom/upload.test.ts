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
    {
      request: async () => ({
        upload_destination: 'https://uploads.intercomcdn.com/',
        public_url: 'https://downloads.intercomcdn.com/image.png',
        policy: 'test-policy',
        key: 'image.png',
      }),
      assertCurrent: async () => {},
    },
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
