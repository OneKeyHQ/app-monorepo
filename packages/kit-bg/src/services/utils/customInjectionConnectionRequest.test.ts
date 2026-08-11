import { shouldMuteCustomInjectionConnectionRequest } from './customInjectionConnectionRequest';

const enabledSettings = {
  enabled: true,
  settings: {
    customInjection: {
      enabled: true,
      workspace: '/workspace/cross-inpage-provider',
      muteConnectionRequests: true,
    },
  },
};

describe('shouldMuteCustomInjectionConnectionRequest', () => {
  it('mutes requests attested by the Custom Injection WebView host', () => {
    expect(
      shouldMuteCustomInjectionConnectionRequest({
        request: { isCustomInjectionRequest: true },
        devSettings: enabledSettings,
      }),
    ).toBe(true);
  });

  it('does not mute a regular DApp request', () => {
    expect(
      shouldMuteCustomInjectionConnectionRequest({
        request: { isCustomInjectionRequest: false },
        devSettings: enabledSettings,
      }),
    ).toBe(false);
  });

  it.each([
    { enabled: false },
    {
      enabled: true,
      settings: {
        customInjection: {
          enabled: false,
          workspace: '/workspace/cross-inpage-provider',
          muteConnectionRequests: true,
        },
      },
    },
    {
      enabled: true,
      settings: {
        customInjection: {
          enabled: true,
          workspace: '/workspace/cross-inpage-provider',
          muteConnectionRequests: false,
        },
      },
    },
  ])('does not mute when the setting is inactive', (devSettings) => {
    expect(
      shouldMuteCustomInjectionConnectionRequest({
        request: { isCustomInjectionRequest: true },
        devSettings,
      }),
    ).toBe(false);
  });
});
