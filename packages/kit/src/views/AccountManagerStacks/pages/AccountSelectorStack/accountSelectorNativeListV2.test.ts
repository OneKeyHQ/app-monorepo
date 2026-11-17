import { ANDROID_PACKAGE_NAME } from '@onekeyhq/shared/src/config/appConfig';

import {
  accountSelectorAccountVisualV2,
  accountSelectorAssetUriV2,
} from './accountSelectorNativeListV2';

import type {
  NativeListTheme,
  VisualOverlay,
} from '@onekeyfe/react-native-native-list';

let mockResolvedAssetUri: string | undefined;

// The web image optimizer is a browser-only module; the badge test only needs
// the resolved source handed back.
jest.mock('@onekeyhq/components/src/primitives/Image/optimization', () => ({
  buildOptimizedImageSource: ({
    resolvedSource,
  }: {
    resolvedSource: unknown;
  }) => resolvedSource,
}));

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

describe('accountSelectorAccountVisualV2 network badge', () => {
  const theme = {
    strongBackground: '#F0F0F0',
    secondaryText: '#646464',
    rowBackground: '#FFFFFF',
    iconSubdued: '#8D8D8D',
  } as unknown as NativeListTheme;

  function badge(
    network: Parameters<typeof accountSelectorAccountVisualV2>[0]['network'],
  ): VisualOverlay | undefined {
    const visual = accountSelectorAccountVisualV2({ network, theme });
    return 'overlays' in visual ? visual.overlays?.[0] : undefined;
  }

  // OK-66073: the evm--20250217 (XP) network's badge rendered as an empty white disc. The
  // overlay only carried the logo image, so a logo that fails to load (or a
  // network without one) left nothing inside the badge; every other list draws
  // the globe glyph in that case.
  it('draws the globe glyph when the network has no logo', () => {
    const overlay = badge({
      logoURI: '',
      name: 'XP Mainnet',
    });
    expect(overlay?.image).toBeUndefined();
    expect(overlay).toMatchObject({
      name: 'GlobusOutline',
      tintColor: theme.iconSubdued,
    });
  });

  it('keeps the globe glyph as the fallback behind a network logo', () => {
    const overlay = badge({
      logoURI: 'https://uni.onekey-asset.com/static/chain/xphere.webp',
      name: 'XP Mainnet',
    });
    expect(overlay?.image).toBeDefined();
    expect(overlay?.name).toBeUndefined();
    expect(overlay?.fallbackIcon).toEqual({
      name: 'GlobusOutline',
      tintColor: theme.iconSubdued,
    });
  });

  it('keeps the custom-network letter and the All Networks glyph', () => {
    expect(badge({ isCustomNetwork: true, name: 'Zeta' })).toMatchObject({
      text: 'Z',
    });
    expect(
      badge({ isCustomNetwork: true, name: 'Zeta' })?.name,
    ).toBeUndefined();
    expect(badge({ isAllNetworks: true })).toMatchObject({
      name: 'AllNetworksSolid',
    });
  });
});
