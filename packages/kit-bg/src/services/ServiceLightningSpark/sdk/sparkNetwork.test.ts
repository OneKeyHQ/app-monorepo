import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import { SparkWebSocket, getSparkUpstream, sparkFetch } from './sparkNetwork';

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    lightning: {
      spark: {
        requestBlocked: jest.fn(),
        requestFailed: jest.fn(),
        requestSent: jest.fn(),
      },
    },
  },
}));

const sparkLog = defaultLogger.lightning.spark as unknown as Record<
  'requestBlocked' | 'requestFailed' | 'requestSent',
  jest.Mock<void, [Record<string, unknown>]>
>;
const stubFetch = jest.fn<Promise<Response>, [unknown, RequestInit?]>();

describe('Breez SDK Spark network policy', () => {
  beforeAll(() => {
    globalThis.fetch = stubFetch as typeof fetch;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    stubFetch.mockImplementation(async () => new Response('ok'));
  });

  it('names every allowed upstream and nothing else', () => {
    expect(
      getSparkUpstream(
        'https://0.spark.lightspark.com/spark.SparkService/query_nodes',
      ),
    ).toBe('operator-lightspark');
    expect(
      getSparkUpstream(
        'https://datasync.breez.technology:442/sync.Syncer/ListenChanges',
      ),
    ).toBe('breez-datasync');
    expect(getSparkUpstream('https://nd1.breez.technology/api/jwt?a=1')).toBe(
      'breez-auth',
    );
    expect(
      getSparkUpstream('https://api.lightspark.com/graphql/spark/2025-03-19'),
    ).toBe('ssp');
    expect(getSparkUpstream('https://api.flashnet.xyz/v1')).toBeUndefined();
    expect(
      getSparkUpstream('https://0.spark.lightspark.com:8443/x'),
    ).toBeUndefined();
  });

  it('sends an allowed request directly with method, headers and body, refusing redirects', async () => {
    const body = new Uint8Array([0, 0, 0, 0, 2, 8, 1]);
    const url = 'https://2.spark.flashnet.xyz/spark.SparkService/query_nodes';
    await sparkFetch(
      new Request(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/grpc-web+proto',
          'x-grpc-web': '1',
        },
        body,
      }),
    );

    const [sentUrl, init] = stubFetch.mock.calls[0];
    expect(sentUrl).toBe(url);
    expect(init?.method).toBe('POST');
    expect(init?.redirect).toBe('error');
    expect(init?.headers).toEqual({
      'content-type': 'application/grpc-web+proto',
      'x-grpc-web': '1',
    });
    expect(new Uint8Array(init?.body as ArrayBuffer)).toEqual(body);
    expect(sparkLog.requestSent).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        upstream: 'operator-flashnet',
        path: '/spark.SparkService/query_nodes',
        status: 200,
      }),
    );
  });

  it('refuses and logs any destination outside the list', async () => {
    await expect(
      sparkFetch('https://api.flashnet.xyz/v1/auth/challenge?x=secret', {
        method: 'POST',
      }),
    ).rejects.toThrow('Lightning Spark request blocked: api.flashnet.xyz');
    expect(() => new SparkWebSocket('wss://relay.example.com/ws')).toThrow(
      'Lightning Spark WebSocket blocked: relay.example.com',
    );

    expect(stubFetch).not.toHaveBeenCalled();
    // The query string is never logged.
    expect(sparkLog.requestBlocked.mock.calls).toEqual([
      [
        {
          method: 'POST',
          host: 'api.flashnet.xyz',
          path: '/v1/auth/challenge',
        },
      ],
      [{ method: 'WEBSOCKET', host: 'relay.example.com', path: '/ws' }],
    ]);
  });

  it('logs calls that fail by HTTP status, gRPC status or network error', async () => {
    const url = 'https://0.spark.lightspark.com/spark.SparkService/query_nodes';
    stubFetch.mockResolvedValueOnce(new Response('', { status: 502 }));
    await sparkFetch(url, { method: 'POST' });
    stubFetch.mockResolvedValueOnce(
      new Response('', { headers: { 'grpc-status': '14' } }),
    );
    await sparkFetch(url, { method: 'POST' });
    stubFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(sparkFetch(url, { method: 'POST' })).rejects.toThrow(
      'Failed to fetch',
    );

    expect(sparkLog.requestFailed.mock.calls.map(([call]) => call)).toEqual([
      expect.objectContaining({ status: 502 }),
      expect.objectContaining({ status: 200, grpcStatus: '14' }),
      expect.objectContaining({ error: 'Failed to fetch' }),
    ]);
  });

  it('does not report the SDK cancelling its own call', async () => {
    const controller = new AbortController();
    controller.abort();
    stubFetch.mockRejectedValueOnce(new DOMException('aborted', 'AbortError'));

    await expect(
      sparkFetch(
        'https://0.spark.lightspark.com/spark.SparkService/subscribe_to_events',
        { method: 'POST', signal: controller.signal },
      ),
    ).rejects.toThrow();
    expect(sparkLog.requestFailed).not.toHaveBeenCalled();
  });

  it('lets the SDK load its own wasm binary', async () => {
    const wasmUrl =
      'https://app.onekey.so/static/breez/breez_sdk_spark_wasm_bg.1a2b3c4d.wasm';
    await sparkFetch(wasmUrl);

    expect(stubFetch).toHaveBeenCalledWith(wasmUrl, undefined);
  });
});
