import { EventEmitter } from 'events';
import { Readable } from 'stream';

import { EUpdateErrorCode } from '@onekeyhq/shared/src/modules3rdParty/auto-update/error';

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
  ).rejects.toThrow('"code":"TIMEOUT"');
  expect(mockRequest.mock.results[0].value.abort).toHaveBeenCalledTimes(1);
});

test('cancels an in-flight Electron request', async () => {
  mockRequest.mockImplementation(() =>
    Object.assign(new EventEmitter(), {
      setHeader: jest.fn(),
      abort: jest.fn(),
      end: jest.fn(),
    }),
  );
  const controller = new AbortController();
  const request = requestUpdateUrl(
    'https://origin.test/package.zip',
    {},
    controller.signal,
  );
  controller.abort();
  await expect(request).rejects.toThrow('"code":"CANCELLED"');
  expect(mockRequest.mock.results[0].value.abort).toHaveBeenCalledTimes(1);
});

test('destroying an unused Electron response aborts without draining the body', async () => {
  let consumed = 0;
  const incoming = Object.assign(
    new Readable({
      read() {
        consumed += 1;
        this.push(Buffer.alloc(1024));
      },
    }),
    { statusCode: 200, headers: {} },
  );
  const request = requestFor('https://fixture.test/package');
  request.end.mockImplementation(() => {
    setImmediate(() => request.emit('response', incoming));
  });
  mockRequest.mockReturnValue(request);
  const result = await requestUpdateUrl('https://fixture.test/package', {});
  result.response.destroy();
  expect(request.abort).toHaveBeenCalledTimes(1);
  expect(incoming.destroyed).toBe(true);
  expect(consumed).toBe(0);
});

test('times out a response body that stalls after delivering its first chunk', async () => {
  let started = false;
  const incoming = Object.assign(
    new Readable({
      read() {
        if (!started) {
          started = true;
          this.push(Buffer.from('first chunk'));
        }
      },
    }),
    { statusCode: 206, headers: {} },
  );
  const request = requestFor('https://fixture.test/package');
  request.end.mockImplementation(() => {
    setImmediate(() => request.emit('response', incoming));
  });
  mockRequest.mockReturnValue(request);
  const result = await requestUpdateUrl(
    'https://fixture.test/package',
    {},
    undefined,
    10,
  );
  const consume = async () => {
    for await (const _chunk of result.response) {
      /* Wait for the body watchdog. */
    }
  };
  await expect(consume()).rejects.toThrow('"code":"TIMEOUT"');
  expect(request.abort).toHaveBeenCalledTimes(1);
  expect(incoming.destroyed).toBe(true);
});

test.each([
  ['net::ERR_NAME_NOT_RESOLVED', EUpdateErrorCode.networkError],
  ['net::ERR_TIMED_OUT', EUpdateErrorCode.timeout],
  ['net::ERR_CERT_AUTHORITY_INVALID', EUpdateErrorCode.securityRejected],
  ['net::ERR_NOT_CLASSIFIED', EUpdateErrorCode.unknown],
])('classifies actual Electron request error %s', async (token, code) => {
  mockRequest.mockImplementation(() => {
    const request = requestFor('https://fixture.test/package');
    request.end.mockImplementation(() => {
      setImmediate(() => request.emit('error', new Error(token)));
    });
    return request;
  });
  await expect(
    requestUpdateUrl('https://fixture.test/package', {}),
  ).rejects.toMatchObject({
    data: { updateError: { code, step: 'download' } },
  });
});

test.each([
  ['same origin', 'https://origin.test/package.zip', true],
  ['cross origin', 'https://cdn.fixture.test/package.zip', false],
  ['different port', 'https://origin.test:444/package.zip', false],
])(
  'preserves private headers only on %s redirects',
  async (_label, destination, sameOrigin) => {
    mockRequest.mockImplementation(({ url }) => {
      const request = requestFor(url);
      request.end.mockImplementation(() => {
        setImmediate(() => {
          if (url === 'https://origin.test/entry')
            request.emit('redirect', 302, 'GET', destination, {});
          else request.emit('response', response(200, 'package'));
        });
      });
      return request;
    });
    const { response: body } = await requestUpdateUrl(
      'https://origin.test/entry',
      {
        Authorization: 'private-fixture',
        Cookie: 'private-cookie',
        'X-Onekey-Instance-Id': 'private-instance',
        'User-Agent': 'OneKey-test',
        Range: 'bytes=0-0',
      },
    );
    for await (const _chunk of body) {
      /* Complete the response and release its watchdog. */
    }
    const redirected = mockRequest.mock.results[1].value as ReturnType<
      typeof requestFor
    >;
    for (const name of ['Authorization', 'Cookie', 'X-Onekey-Instance-Id']) {
      if (sameOrigin)
        expect(redirected.setHeader).toHaveBeenCalledWith(
          name,
          expect.any(String),
        );
      else
        expect(redirected.setHeader).not.toHaveBeenCalledWith(
          name,
          expect.any(String),
        );
    }
    expect(redirected.setHeader).toHaveBeenCalledWith(
      'User-Agent',
      'OneKey-test',
    );
    expect(redirected.setHeader).toHaveBeenCalledWith('Range', 'bytes=0-0');
    const initial = mockRequest.mock.results[0].value as ReturnType<
      typeof requestFor
    >;
    expect(initial.abort).toHaveBeenCalledTimes(1);
  },
);

test('sets default Cache-Control: no-cache when not provided and preserves custom Cache-Control', async () => {
  mockRequest.mockImplementation(({ url }: { url: string }) => requestFor(url));
  const first = await requestUpdateUrl('https://cdn.test/latest-mac.yml', {
    Accept: 'text/yaml',
  });
  for await (const _chunk of first.response) {
    /* drain */
  }
  const firstReq = mockRequest.mock.results[0].value as ReturnType<
    typeof requestFor
  >;
  expect(firstReq.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');

  const second = await requestUpdateUrl('https://cdn.test/latest-mac.yml', {
    'cache-control': 'max-age=60',
  });
  for await (const _chunk of second.response) {
    /* drain */
  }
  const secondReq = mockRequest.mock.results[1].value as ReturnType<
    typeof requestFor
  >;
  expect(secondReq.setHeader).not.toHaveBeenCalledWith(
    'Cache-Control',
    'no-cache',
  );
  expect(secondReq.setHeader).toHaveBeenCalledWith(
    'cache-control',
    'max-age=60',
  );
});
