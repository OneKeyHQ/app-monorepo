import { NativeModules, Platform } from 'react-native';

import platformEnv from '../../platformEnv';

import marketWidget from './index.native';

jest.mock('react-native', () => ({
  NativeModules: {},
  Platform: { Version: '17.0' },
}));

jest.mock('../../platformEnv', () => ({
  __esModule: true,
  default: { isNativeIOS: true, isNativeBackgroundThread: false },
}));

describe('market widget editor bridge availability', () => {
  const profile = {
    id: '4bdfeb88-a55d-4a91-bedb-df13acfaea39',
    name: 'Favorites',
    kind: 'list' as const,
    source: 'watchlist' as const,
  };
  const nativeModule = {
    setConfiguration: jest.fn(async () => undefined),
    getEditorState: jest.fn(async () =>
      JSON.stringify({
        profiles: [profile],
        watchlist: [],
        hot: [],
        privacyMasked: false,
      }),
    ),
    saveProfile: jest.fn(async () => JSON.stringify(profile)),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    platformEnv.isNativeIOS = true;
    platformEnv.isNativeBackgroundThread = false;
    NativeModules.OneKeyMarketWidget = nativeModule;
  });

  it('preserves the native-assigned profile ID when reading and saving', async () => {
    expect(marketWidget.supportsProfileEditing()).toBe(true);
    expect(await marketWidget.getEditorState()).toMatchObject({
      profiles: [profile],
    });
    expect(await marketWidget.saveProfile(profile)).toEqual(profile);
    expect(nativeModule.saveProfile).toHaveBeenCalledWith(
      JSON.stringify(profile),
    );
  });

  it('keeps configuration sync on older shells but rejects unsupported editing', async () => {
    NativeModules.OneKeyMarketWidget = {
      setConfiguration: nativeModule.setConfiguration,
    };
    expect(marketWidget.isSupported()).toBe(true);
    expect(marketWidget.supportsProfileEditing()).toBe(false);
    await expect(marketWidget.saveProfile(profile)).rejects.toThrow(
      'unavailable',
    );
    expect(nativeModule.saveProfile).not.toHaveBeenCalled();
  });

  it('does not expose the UI-owned module in the native background runtime', async () => {
    platformEnv.isNativeBackgroundThread = true;
    expect(marketWidget.supportsProfileEditing()).toBe(false);
    await expect(marketWidget.getEditorState()).rejects.toThrow('unavailable');
    expect(nativeModule.getEditorState).not.toHaveBeenCalled();
  });

  it('does not expose profile editing on Android or pre-AppIntent iOS', () => {
    platformEnv.isNativeIOS = false;
    expect(marketWidget.supportsProfileEditing()).toBe(false);
    platformEnv.isNativeIOS = true;
    jest.replaceProperty(Platform, 'Version', '16.4');
    expect(marketWidget.supportsProfileEditing()).toBe(false);
  });
});
