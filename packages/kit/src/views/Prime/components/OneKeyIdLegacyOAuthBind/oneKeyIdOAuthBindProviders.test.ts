import { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';

import { getOneKeyIdOAuthBindProviders } from './oneKeyIdOAuthBindProviders';

describe('getOneKeyIdOAuthBindProviders', () => {
  test('offers both providers when neither entry nor local Keyless requires one', () => {
    expect(getOneKeyIdOAuthBindProviders({})).toEqual([
      EOAuthSocialLoginProvider.Google,
      EOAuthSocialLoginProvider.Apple,
    ]);
  });

  test.each([
    EOAuthSocialLoginProvider.Google,
    EOAuthSocialLoginProvider.Apple,
  ])('uses the required provider for a constrained entry: %s', (provider) => {
    expect(
      getOneKeyIdOAuthBindProviders({ requiredProvider: provider }),
    ).toEqual([provider]);
  });

  test('always prioritizes the local Keyless provider', () => {
    expect(
      getOneKeyIdOAuthBindProviders({
        localKeylessProvider: EOAuthSocialLoginProvider.Google,
        requiredProvider: EOAuthSocialLoginProvider.Apple,
      }),
    ).toEqual([EOAuthSocialLoginProvider.Google]);
  });
});
