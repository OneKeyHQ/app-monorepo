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
        settings: [profile],
        watchlist: [],
        hot: [],
        privacyMasked: false,
      }),
    ),
    saveProfile: jest.fn(async () => JSON.stringify(profile)),
    saveSettings: jest.fn(async () => JSON.stringify(profile)),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    platformEnv.isNativeIOS = true;
    platformEnv.isNativeAndroid = false;
    platformEnv.isNativeBackgroundThread = false;
    NativeModules.OneKeyMarketWidget = nativeModule;
  });

  it('requires explicit native stock support and does not expose it in the background runtime', () => {
    expect(marketWidget.supportsStockAssets()).toBe(false);
    NativeModules.OneKeyMarketWidget = {
      ...nativeModule,
      stockSupportVersion: 1,
    };
    expect(marketWidget.supportsStockAssets()).toBe(true);
    platformEnv.isNativeBackgroundThread = true;
    expect(marketWidget.supportsStockAssets()).toBe(false);
  });

  it('routes Android reads and saves through the same native-validated session', async () => {
    platformEnv.isNativeIOS = false;
    platformEnv.isNativeAndroid = true;
    const token = '4bdfeb88-a55d-4a91-bedb-df13acfaea39';
    const getWidgetEditorState = jest.fn(async () =>
      nativeModule.getEditorState(),
    );
    const saveWidgetSettings = jest.fn(async () => JSON.stringify(profile));
    const finishWidgetEditing = jest.fn(async () => undefined);
    NativeModules.OneKeyMarketWidget = {
      ...nativeModule,
      getWidgetEditorState,
      saveWidgetSettings,
      finishWidgetEditing,
    };
    expect(marketWidget.supportsSettingsEditing()).toBe(true);
    await expect(marketWidget.getEditorState()).rejects.toThrow('session');
    await marketWidget.getEditorState(token);
    expect(getWidgetEditorState).toHaveBeenCalledWith(token);
    await marketWidget.saveSettings(profile, token);
    expect(saveWidgetSettings).toHaveBeenCalledWith(
      token,
      JSON.stringify(profile),
    );
    expect(nativeModule.saveSettings).not.toHaveBeenCalled();
    await marketWidget.finishEditing?.(token, true);
    expect(finishWidgetEditing).toHaveBeenCalledWith(token, true);
    platformEnv.isNativeBackgroundThread = true;
    expect(marketWidget.supportsSettingsEditing()).toBe(false);
    await expect(marketWidget.saveSettings(profile, token)).rejects.toThrow(
      'session',
    );
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

  it('saves type settings without requiring a configuration identity', async () => {
    expect(marketWidget.supportsSettingsEditing()).toBe(true);
    const input = {
      name: profile.name,
      kind: profile.kind,
      source: profile.source,
    };
    await expect(marketWidget.saveSettings(input)).resolves.toEqual(profile);
    expect(nativeModule.saveSettings).toHaveBeenCalledWith(
      JSON.stringify(input),
    );
    expect(nativeModule.saveProfile).not.toHaveBeenCalled();
  });

  it('does not advertise direct settings on a binary that only supports bound profiles', async () => {
    NativeModules.OneKeyMarketWidget = {
      ...nativeModule,
      saveSettings: undefined,
    };
    expect(marketWidget.supportsSettingsEditing()).toBe(false);
    await expect(marketWidget.saveSettings(profile)).rejects.toThrow(
      'unavailable',
    );
    expect(nativeModule.saveProfile).not.toHaveBeenCalled();
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

  it('refreshes metadata separately from reading the local snapshot', async () => {
    const refreshEditorState = jest.fn(async () =>
      nativeModule.getEditorState(),
    );
    NativeModules.OneKeyMarketWidget = { ...nativeModule, refreshEditorState };
    await marketWidget.getEditorState();
    expect(refreshEditorState).not.toHaveBeenCalled();
    await expect(marketWidget.refreshEditorState?.()).resolves.toMatchObject({
      profiles: [profile],
    });
    expect(refreshEditorState).toHaveBeenCalledTimes(1);
  });

  it('keeps editor refresh compatible with a shell without the optional refresh method', async () => {
    await expect(marketWidget.refreshEditorState?.()).resolves.toMatchObject({
      profiles: [profile],
    });
    expect(nativeModule.getEditorState).toHaveBeenCalledTimes(1);
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
