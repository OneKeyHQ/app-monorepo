const ohttpGet = jest.fn<Promise<unknown>, unknown[]>();

jest.mock('./internal/ohttp-client', () => ({
  OhttpClient: class {
    get = ohttpGet;
  },
}));

// eslint-disable-next-line import/first
import { IndexerDiscoveryProvider } from '.';

// eslint-disable-next-line import/first
import { ServiceHttpError } from './internal/errors';

const provider = () =>
  new IndexerDiscoveryProvider('https://discovery.example', '0x1', {
    ohttp: { publicKeyConfig: new Uint8Array([1]) },
  });

beforeEach(() => {
  jest.useFakeTimers();
  ohttpGet.mockReset();
});

afterEach(() => {
  jest.useRealTimers();
});

it('backs off on 429 and honors Retry-After before retrying', async () => {
  ohttpGet
    .mockRejectedValueOnce(
      new ServiceHttpError('OHTTP request /health', 429, '2'),
    )
    .mockResolvedValueOnce({ status: 'OK' });
  const result = provider().getHealth();
  await jest.advanceTimersByTimeAsync(1999);
  expect(ohttpGet).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(1);
  await expect(result).resolves.toEqual({ status: 'OK' });
  expect(ohttpGet).toHaveBeenCalledTimes(2);
});

it('retries inner 503 errors with bounded exponential backoff', async () => {
  ohttpGet
    .mockRejectedValueOnce(
      new ServiceHttpError('OHTTP inner response /health', 503, null),
    )
    .mockRejectedValueOnce(
      new ServiceHttpError('OHTTP inner response /health', 503, null),
    )
    .mockResolvedValueOnce({ status: 'OK' });
  const result = provider().getHealth();
  await jest.advanceTimersByTimeAsync(1000);
  expect(ohttpGet).toHaveBeenCalledTimes(2);
  await jest.advanceTimersByTimeAsync(2000);
  await expect(result).resolves.toEqual({ status: 'OK' });
  expect(ohttpGet).toHaveBeenCalledTimes(3);
});

it.each([400, 413])('does not retry a terminal HTTP %s', async (status) => {
  const failure = new ServiceHttpError('OHTTP request /health', status, null);
  ohttpGet.mockRejectedValue(failure);
  await expect(provider().getHealth()).rejects.toBe(failure);
  expect(ohttpGet).toHaveBeenCalledTimes(1);
});

it('surfaces a long cooldown without retrying early', async () => {
  const failure = new ServiceHttpError('OHTTP request /health', 429, '300');
  ohttpGet.mockRejectedValue(failure);
  await expect(provider().getHealth()).rejects.toBe(failure);
  expect(ohttpGet).toHaveBeenCalledTimes(1);
});

it('stops after two retries on a continuing outage', async () => {
  const failure = new ServiceHttpError('OHTTP request /health', 503, null);
  ohttpGet.mockRejectedValue(failure);
  const result = (async () => {
    await expect(provider().getHealth()).rejects.toBe(failure);
  })();
  await jest.runAllTimersAsync();
  await result;
  expect(ohttpGet).toHaveBeenCalledTimes(3);
});
