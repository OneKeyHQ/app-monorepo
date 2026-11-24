import axios from 'axios';

import { KEYLESS_SYNC_SIGNATURE_HEADER } from '@onekeyhq/shared/src/consts/keylessCloudSyncConsts';

import { keylessCloudSyncApi } from './keylessCloudSyncApi';

test('check and upload carry cancellation and timeout into the actual Axios configuration', async () => {
  const client = axios.create();
  const post = jest
    .spyOn(client, 'post')
    .mockResolvedValue({ data: { data: {} } });
  const controller = new AbortController();
  const requestOptions = { signal: controller.signal, timeout: 10_000 };
  await keylessCloudSyncApi.checkStatus({
    client,
    signatureHeader: 'public-test-header',
    postData: {
      localData: [],
      onlyCheckLocalDataType: [],
      nonce: 123,
      pwdHash: 'test-space',
    },
    requestOptions,
  });
  await keylessCloudSyncApi.upload({
    client,
    urlPath: '/test/upload',
    signatureHeader: 'public-test-header',
    postData: { localData: [], nonce: 124, pwdHash: 'test-space' },
    requestOptions,
  });
  for (const [, , config] of post.mock.calls) {
    expect(config?.signal).toBe(controller.signal);
    expect(config?.timeout).toBe(10_000);
    expect(config?.headers).toEqual({
      [KEYLESS_SYNC_SIGNATURE_HEADER]: 'public-test-header',
    });
  }
  controller.abort();
  expect(post.mock.calls[0][2]?.signal?.aborted).toBe(true);
  post.mockRestore();
});
