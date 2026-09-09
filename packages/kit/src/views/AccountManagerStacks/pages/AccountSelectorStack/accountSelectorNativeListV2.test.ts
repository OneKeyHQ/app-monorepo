import { ANDROID_PACKAGE_NAME } from '@onekeyhq/shared/src/config/appConfig';

import { accountSelectorAssetUriV2 } from './accountSelectorNativeListV2';

let mockResolvedAssetUri: string | undefined;

jest.mock('react-native', () => ({
  Image: {
    resolveAssetSource: () =>
      mockResolvedAssetUri ? { uri: mockResolvedAssetUri } : undefined,
  },
  Platform: { OS: 'android' },
}));

describe('accountSelectorAssetUriV2', () => {
  beforeEach(() => {
    mockResolvedAssetUri = undefined;
  });

  it('converts an Android release drawable name to a loadable resource URI', () => {
    mockResolvedAssetUri = 'wallet_avatar_bear';

    expect(accountSelectorAssetUriV2(1)).toBe(
      `android.resource://${ANDROID_PACKAGE_NAME}/drawable/wallet_avatar_bear`,
    );
  });

  it('keeps a Metro development asset URL unchanged', () => {
    const uri = 'http://10.0.2.2:8088/assets/wallet/avatar/Bear.png';
    mockResolvedAssetUri = uri;

    expect(accountSelectorAssetUriV2(1)).toBe(uri);
  });
});
