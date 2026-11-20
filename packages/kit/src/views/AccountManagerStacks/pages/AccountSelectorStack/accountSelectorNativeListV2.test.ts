import { EDeviceType } from '@onekeyfe/hd-shared';
import { Platform } from 'react-native';

import { ANDROID_PACKAGE_NAME } from '@onekeyhq/shared/src/config/appConfig';
import { AllWalletAvatarImages } from '@onekeyhq/shared/src/utils/avatarUtils';

import {
  accountSelectorAccountVisualV2,
  accountSelectorAssetUriV2,
  accountSelectorWalletVisualV2,
} from './accountSelectorNativeListV2';

import type {
  NativeListTheme,
  VisualOverlay,
} from '@onekeyfe/react-native-native-list';

let mockResolvedAssetUri: string | undefined;

const theme = {
  strongBackground: '#F0F0F0',
  primaryText: '#303030',
  secondaryText: '#646464',
  rowBackground: '#FFFFFF',
  iconSubdued: '#8D8D8D',
} as unknown as NativeListTheme;

// The web image optimizer is a browser-only module; the badge test only needs
// the resolved source handed back.
jest.mock('@onekeyhq/components/src/primitives/Image/optimization', () => ({
  buildOptimizedImageSource: ({
    resolvedSource,
  }: {
    resolvedSource: unknown;
  }) => resolvedSource,
}));

jest.mock('react-native', () => {
  const platform = { OS: 'android' };
  return {
    Image: {
      get resolveAssetSource() {
        if (platform.OS === 'web') return undefined;
        return () =>
          mockResolvedAssetUri ? { uri: mockResolvedAssetUri } : undefined;
      },
    },
    Platform: platform,
  };
});

jest.mock('@onekeyhq/shared/src/platformEnv', () => {
  const { Platform: platform } =
    jest.requireMock<typeof import('react-native')>('react-native');
  return {
    __esModule: true,
    default: {
      get isNative() {
        return platform.OS !== 'web';
      },
      get isWeb() {
        return platform.OS === 'web';
      },
    },
  };
});

beforeEach(() => {
  mockResolvedAssetUri = undefined;
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('accountSelectorAssetUriV2', () => {
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

  it('keeps a resolved iOS asset URL unchanged', () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    const uri = 'file:///bundle/Bear.png';
    mockResolvedAssetUri = uri;

    expect(accountSelectorAssetUriV2(1)).toBe(uri);
  });

  it('reads image objects and skips native asset IDs on Desktop', () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    const uri = 'https://example.com/avatar.png';

    expect(accountSelectorAssetUriV2({ uri })).toBe(uri);
    expect(accountSelectorAssetUriV2({ uri: undefined })).toBe('');
    expect(accountSelectorAssetUriV2('   ')).toBe('');
    expect(accountSelectorAssetUriV2(1)).toBe('');
  });
});

describe('accountSelectorWalletVisualV2 avatar', () => {
  it.each([
    ['qr', 'rounded', expect.stringMatching(/^data:image\/png;base64,/)],
    ['hd', 'square', AllWalletAvatarImages.bear],
  ] as const)(
    'renders the fallback for an unknown %s avatar on Desktop',
    (type, shape, uri) => {
      jest.replaceProperty(Platform, 'OS', 'web');

      const visual = accountSelectorWalletVisualV2({
        wallet: {
          id: `${type}-test`,
          type,
          name: 'Test wallet',
          accounts: [],
          avatarInfo: { img: EDeviceType.Unknown },
          backuped: true,
          nextIds: {},
          walletNo: 1,
        },
        theme,
        badgeBackground: '#FFFFFF',
        connectionColor: '#008000',
      });

      expect(visual).toMatchObject({ kind: 'wallet', shape, image: { uri } });
    },
  );
});

describe('accountSelectorAccountVisualV2 network badge', () => {
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
