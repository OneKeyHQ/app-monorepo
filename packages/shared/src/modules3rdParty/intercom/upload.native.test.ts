import { OneKeyLocalError } from '../../errors';

import { uploadIntercomImage } from './upload';

import type { IIntercomMessengerSession } from './messengerTypes';
import type { Image } from '@onekeyfe/react-native-image-crop-picker';

jest.mock('../../errors', () => ({ OneKeyLocalError: Error }));
jest.mock('expo-file-system', () => ({
  File: class extends Blob {
    uri: string;

    constructor(uri: string) {
      super([new Uint8Array([1])], { type: 'image/png' });
      this.uri = uri;
    }

    override async bytes() {
      return new Uint8Array([1]);
    }
  },
}));
jest.mock('./uploadFile', () =>
  jest.requireActual<typeof import('./uploadFile.native')>(
    './uploadFile.native',
  ),
);

const image: Image = {
  path: 'file:///tmp/support-image.png',
  filename: 'support-image.png',
  mime: 'image/png',
  size: 120,
  width: 10,
  height: 12,
};
const upload = {
  upload_destination: 'https://uploads.intercomcdn.com/',
  public_url: 'https://uploads.intercomcdn.com/image.png',
  policy: 'test-upload-policy',
  key: 'image.png',
  content_type: 'image/png',
  metadata: { safe_app_id: 'test-app' },
};

const originalFetch = globalThis.fetch;
afterEach(() => {
  jest.restoreAllMocks();
  globalThis.fetch = originalFetch;
});

it('uploads only the selected file to the signed destination without app auth headers', async () => {
  const request = jest.fn(async () => upload);
  const assertCurrent = jest.fn(async () => {});
  const session: IIntercomMessengerSession = { request, assertCurrent };
  const append = jest
    .spyOn(FormData.prototype, 'append')
    .mockImplementation(() => {});
  const fetchMock = jest.fn(async () => new Response(null, { status: 201 }));
  globalThis.fetch = fetchMock;
  const controller = new AbortController();
  await expect(
    uploadIntercomImage(session, image, controller.signal),
  ).resolves.toMatchObject({
    type: 'image',
    url: upload.public_url,
    width: 10,
    height: 12,
  });
  expect(request).toHaveBeenCalledWith('uploads', {
    upload: {
      original_filename: image.filename,
      content_type: image.mime,
      size_in_bytes: image.size,
      width: 10,
      height: 12,
    },
    include_metadata: true,
  });
  expect(append).toHaveBeenCalledWith(
    'file',
    expect.objectContaining({ uri: image.path, bytes: expect.any(Function) }),
    image.filename,
  );
  expect(append).toHaveBeenCalledWith('x-amz-meta-safe_app_id', 'test-app');
  expect(fetchMock).toHaveBeenCalledWith(upload.upload_destination, {
    method: 'POST',
    body: expect.any(FormData),
    signal: controller.signal,
  });
  expect(assertCurrent).toHaveBeenCalledTimes(2);
});

it('does not upload a file after the support session changes', async () => {
  const session: IIntercomMessengerSession = {
    request: async () => upload,
    assertCurrent: async () => {
      throw new OneKeyLocalError('Session changed');
    },
  };
  const fetchMock = jest.spyOn(globalThis, 'fetch');
  await expect(
    uploadIntercomImage(session, image, new AbortController().signal),
  ).rejects.toThrow('Session changed');
  expect(fetchMock).not.toHaveBeenCalled();
});

it('rejects an oversized image before requesting upload credentials', async () => {
  const request = jest.fn();
  const session: IIntercomMessengerSession = {
    request,
    assertCurrent: async () => {},
  };
  await expect(
    uploadIntercomImage(
      session,
      { ...image, size: 21 * 1024 * 1024 },
      new AbortController().signal,
    ),
  ).rejects.toThrow('20 MB');
  expect(request).not.toHaveBeenCalled();
});

it('rejects an insecure upload destination before sending file contents', async () => {
  const session: IIntercomMessengerSession = {
    request: async () => ({
      ...upload,
      upload_destination: 'http://example.com',
    }),
    assertCurrent: async () => {},
  };
  const fetchMock = jest.spyOn(globalThis, 'fetch');
  await expect(
    uploadIntercomImage(session, image, new AbortController().signal),
  ).rejects.toThrow('Invalid support upload destination');
  expect(fetchMock).not.toHaveBeenCalled();
});
