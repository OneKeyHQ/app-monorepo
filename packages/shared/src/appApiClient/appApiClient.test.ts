import { EServiceEndpointEnum } from '../../types/endpoint';
import platformEnv from '../platformEnv';

import { appApiClient } from './appApiClient';

test('a new service address replaces the cached client even while the original client is resolving', async () => {
  const name = EServiceEndpointEnum.Prime;
  const previous = 'https://prime-old.example.invalid';
  const current = 'https://prime-new.example.invalid/gateway';
  appApiClient.clearClientCache();
  try {
    const oldClient = appApiClient.getClient({ name, endpoint: previous });
    const newClient = await appApiClient.getClient({ name, endpoint: current });
    expect((await oldClient).defaults.baseURL).toBe(previous);
    expect(newClient.defaults.baseURL).toBe(current);
    await expect(
      appApiClient.getClient({ name, endpoint: current }),
    ).resolves.toBe(newClient);
  } finally {
    appApiClient.clearClientCache();
  }
});

test('an official client connects directly with the development proxy enabled', async () => {
  jest.replaceProperty(platformEnv, 'isDev', true);
  jest.replaceProperty(process, 'env', { ...process.env, ONEKEY_PROXY: '1' });
  const endpoint = 'https://prime-new.example.invalid/gateway';
  const name = EServiceEndpointEnum.Prime;
  appApiClient.clearClientCache();
  try {
    const general = await appApiClient.getClient({ name, endpoint });
    const official = await appApiClient.getOfficialClient({ name, endpoint });
    expect(general.defaults.headers['X-OneKey-Dev-Proxy']).toBe(endpoint);
    expect(official.defaults.baseURL).toBe(endpoint);
    expect(official.defaults.headers['X-OneKey-Dev-Proxy']).toBeUndefined();
  } finally {
    jest.restoreAllMocks();
    appApiClient.clearClientCache();
  }
});
