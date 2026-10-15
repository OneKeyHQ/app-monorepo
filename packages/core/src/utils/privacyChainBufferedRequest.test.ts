import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  FETCH_STREAM_CHUNK_BYTES,
  createFetchStreamHandler,
} from '@onekeyhq/shared/src/utils/fetchStream';
import type { IFetchStreamRequest } from '@onekeyhq/shared/types/fetchStream';

import { createPrivacyChainBufferedRequest } from './privacyChainBufferedRequest';

it('assembles binary RPC bytes after segmented bridge reads, preserving the request', async () => {
  const responseBytes = new Uint8Array(FETCH_STREAM_CHUNK_BYTES * 2 + 17).fill(
    7,
  );
  const fetchImpl = jest.fn(async () => new Response(responseBytes));
  const relay = createFetchStreamHandler(fetchImpl);
  const calls: IFetchStreamRequest[] = [];
  const request = createPrivacyChainBufferedRequest(async (message) => {
    calls.push(message);
    return relay(message);
  });
  const bytes = await request(
    'http://node.example/get_blocks.bin',
    'application/octet-stream',
    new Uint8Array([1, 2]),
  );
  expect(bytes).toEqual(responseBytes);
  expect(calls[0]).toMatchObject({
    action: 'open',
    headers: [['content-type', 'application/octet-stream']],
    b64: 'AQI=',
  });
  expect(calls.filter((call) => call.action === 'read')).toHaveLength(4);
  const opened = calls[0];
  expect(opened.action).toBe('open');
  const read = calls.find((call) => call.action === 'read');
  if (!read || read.action !== 'read')
    throw new OneKeyLocalError('missing stream read');
  await expect(relay(read)).resolves.toEqual({
    ok: false,
    error: 'fetch stream expired or closed',
  });
});

it('reports HTTP failure and releases an unread error body', async () => {
  const cancel = jest.fn();
  const relay = createFetchStreamHandler(
    async () => new Response(new ReadableStream({ cancel }), { status: 503 }),
  );
  // HTTP status is known before consuming an endless error-page body.
  const request = createPrivacyChainBufferedRequest(relay);
  await expect(
    request('https://node.example/rpc', 'application/json', new Uint8Array()),
  ).rejects.toThrow(OneKeyLocalError);
  expect(cancel).toHaveBeenCalledTimes(1);
});
