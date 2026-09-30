import { EventEmitter } from 'events';
import { Readable } from 'stream';

import { requestUpdateUrl } from './electronUpdateRequest';

const mockRequest = jest.fn<ReturnType<typeof requestFor>, [{ url: string }]>();

jest.mock('electron', () => ({
  net: { request: (options: { url: string }) => mockRequest(options) },
}));

function response(statusCode: number, body: string) {
  return Object.assign(Readable.from([Buffer.from(body)]), {
    statusCode,
    headers: {},
  });
}

function requestFor(url: string) {
  const request = Object.assign(new EventEmitter(), {
    setHeader: jest.fn(),
    abort: jest.fn(),
    end: jest.fn(),
  });
  request.end.mockImplementation(() => {
    setImmediate(() => {
      if (url.includes('start')) {
        request.emit(
          'redirect',
          302,
          'GET',
          'https://cdn.test/package.zip',
          {},
        );
        request.emit('error', new Error('Redirect was cancelled'));
      } else {
        request.emit('response', response(200, 'package'));
      }
    });
  });
  return request;
}

beforeEach(() => {
  mockRequest.mockReset();
});

test('follows Electron manual redirect and strips cross-origin credentials', async () => {
  mockRequest.mockImplementation(({ url }: { url: string }) => requestFor(url));
  const { response: body, url } = await requestUpdateUrl(
    'https://origin.test/start',
    { Authorization: 'secret', Range: 'bytes=0-0', 'User-Agent': 'OneKey' },
  );
  const chunks: Buffer[] = [];
  for await (const chunk of body) chunks.push(chunk);
  expect(Buffer.concat(chunks).toString()).toBe('package');
  expect(url).toBe('https://cdn.test/package.zip');
  expect(mockRequest).toHaveBeenNthCalledWith(1, {
    url: 'https://origin.test/start',
    redirect: 'manual',
  });
  expect(mockRequest).toHaveBeenNthCalledWith(2, {
    url: 'https://cdn.test/package.zip',
    redirect: 'manual',
  });
  const redirected = mockRequest.mock.results[1].value as ReturnType<
    typeof requestFor
  >;
  expect(redirected.setHeader).not.toHaveBeenCalledWith(
    'Authorization',
    'secret',
  );
  expect(redirected.setHeader).toHaveBeenCalledWith('Range', 'bytes=0-0');
});

test('times out a stalled request', async () => {
  mockRequest.mockImplementation(() =>
    Object.assign(new EventEmitter(), {
      setHeader: jest.fn(),
      abort: jest.fn(),
      end: jest.fn(),
    }),
  );
  await expect(
    requestUpdateUrl('https://origin.test/stall', {}, undefined, 10),
  ).rejects.toThrow('Download timeout');
  expect(mockRequest.mock.results[0].value.abort).toHaveBeenCalledTimes(1);
});
