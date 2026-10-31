import { buildIntercomUrl, getIntercomSupportUrl } from './utils';

jest.mock('../../appGlobals', () => ({
  __esModule: true,
  default: {
    $backgroundApiProxy: {
      servicePrime: {
        createIntercomSupportSession: jest.fn(async () => 'handoff'),
      },
      serviceSetting: {
        getInstanceId: jest.fn(async () => 'device'),
        getCurrentLocale: jest.fn(async () => 'ja'),
      },
    },
  },
}));

describe('Support URL', () => {
  it('passes only the background-local handoff and non-secret metadata', async () => {
    const url = new URL(await getIntercomSupportUrl({ requestId: 'request' }));
    expect(url.origin).toBe('https://intercom.onekey.so');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      supportSession: 'handoff',
      instanceId: 'device',
      requestId: 'request',
      language_override: 'ja',
    });
  });

  it('does not serialize credentials even if supplied by a stale caller', () => {
    const staleParams = { token: 'must-not-appear', supportSession: 'handoff' };
    const url = buildIntercomUrl('https://intercom.onekey.so/', staleParams);
    expect(url).not.toContain('must-not-appear');
    expect(url).not.toContain('intercom_user_jwt');
  });
});
