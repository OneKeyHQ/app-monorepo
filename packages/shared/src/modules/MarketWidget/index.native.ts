import { NativeModules, Platform } from 'react-native';

import { OneKeyLocalError } from '../../errors';
import platformEnv from '../../platformEnv';
import { travelModeManager } from '../../travelMode';
import { createMarketWidgetConfigurationWriter } from '../../utils/marketWidgetUtils';

import type {
  IMarketWidgetEditorState,
  IMarketWidgetModule,
  IMarketWidgetProfile,
} from './types';

type IOneKeyMarketWidgetNativeModule = {
  stockSupportVersion?: number;
  setConfiguration: (configuration: string) => Promise<void>;
  maskForTravelMode?: () => Promise<void>;
  beginWidgetEditing?: () => Promise<string>;
  setWidgetEditorDraft?: (session: string, assets: string) => Promise<string>;
  syncQuote?: (update: string) => Promise<boolean>;
  getEditorState?: () => Promise<string>;
  refreshEditorState?: () => Promise<string>;
  saveProfile?: (profile: string) => Promise<string>;
  saveSettings?: (settings: string) => Promise<string>;
  getWidgetEditorState?: (session: string) => Promise<string>;
  refreshWidgetEditorState?: (session: string) => Promise<string>;
  searchWidgetStocks?: (session: string, query: string) => Promise<string>;
  searchStocks?: (query: string) => Promise<string>;
  saveWidgetSettings?: (session: string, settings: string) => Promise<string>;
  finishWidgetEditing?: (session: string, saved: boolean) => Promise<void>;
};

function getConfigurationModule() {
  if (!platformEnv.isNativeBackgroundThread) {
    throw new OneKeyLocalError(
      'Widget configuration is owned by the background runtime',
    );
  }
  return NativeModules.OneKeyMarketWidget as
    | IOneKeyMarketWidgetNativeModule
    | undefined;
}

const configurationWriter = createMarketWidgetConfigurationWriter({
  write: async (configuration) => {
    await getConfigurationModule()?.setConfiguration(
      JSON.stringify(configuration),
    );
  },
  mask: async () => {
    const nativeModule = getConfigurationModule();
    if (!nativeModule?.setConfiguration) return;
    if (!nativeModule.maskForTravelMode)
      throw new OneKeyLocalError('Widget privacy masking is unavailable');
    await nativeModule.maskForTravelMode();
  },
  isMasked: () =>
    travelModeManager.isMaskingDataSync() ||
    !['active', 'inactive'].includes(travelModeManager.getRuntimeStateSync()),
});

function getNativeModule() {
  // This bridge belongs to the UI runtime. Older binaries may receive the
  // same JS update without having the widget target or module installed.
  if (platformEnv.isNativeBackgroundThread) return undefined;
  return NativeModules.OneKeyMarketWidget as
    | IOneKeyMarketWidgetNativeModule
    | undefined;
}

const marketWidget: IMarketWidgetModule = {
  isSupported: () => typeof getNativeModule()?.setConfiguration === 'function',
  supportsStockAssets: () => getNativeModule()?.stockSupportVersion === 1,
  supportsQuoteSync: () => typeof getNativeModule()?.syncQuote === 'function',
  async syncQuote(update) {
    return (
      (await getNativeModule()?.syncQuote?.(JSON.stringify(update))) ?? false
    );
  },
  supportsProfileEditing: () =>
    !!platformEnv.isNativeIOS &&
    Number.parseInt(String(Platform.Version), 10) >= 17 &&
    typeof getNativeModule()?.getEditorState === 'function' &&
    typeof getNativeModule()?.saveProfile === 'function',
  supportsSettingsEditing: () =>
    platformEnv.isNativeIOS
      ? typeof getNativeModule()?.getEditorState === 'function' &&
        typeof getNativeModule()?.saveSettings === 'function'
      : !!platformEnv.isNativeAndroid &&
        typeof getNativeModule()?.getWidgetEditorState === 'function' &&
        typeof getNativeModule()?.saveWidgetSettings === 'function' &&
        typeof getNativeModule()?.finishWidgetEditing === 'function',
  async setConfiguration(configuration) {
    getConfigurationModule();
    await travelModeManager.ready;
    await configurationWriter.write(configuration);
  },
  async maskForTravelMode() {
    getConfigurationModule();
    await configurationWriter.mask();
  },
  async beginEditing() {
    return getNativeModule()?.beginWidgetEditing?.();
  },
  async setEditorDraft(assets, editorSession, visibleAssets = []) {
    const nativeModule = getNativeModule();
    if (!nativeModule?.setWidgetEditorDraft)
      throw new OneKeyLocalError('Widget draft editing is unavailable');
    return JSON.parse(
      await nativeModule.setWidgetEditorDraft(
        editorSession,
        JSON.stringify({ assets, visibleAssets }),
      ),
    ) as IMarketWidgetEditorState;
  },
  async getEditorState(editorSession) {
    const nativeModule = getNativeModule();
    if (platformEnv.isNativeAndroid || editorSession) {
      if (!editorSession || !nativeModule?.getWidgetEditorState) {
        throw new OneKeyLocalError(
          'Market widget editor session is unavailable',
        );
      }
      return JSON.parse(
        await nativeModule.getWidgetEditorState(editorSession),
      ) as IMarketWidgetEditorState;
    }
    if (
      !(
        marketWidget.supportsSettingsEditing() ||
        marketWidget.supportsProfileEditing()
      ) ||
      !nativeModule?.getEditorState
    ) {
      throw new OneKeyLocalError(
        'Market widget profile editing is unavailable',
      );
    }
    return JSON.parse(
      await nativeModule.getEditorState(),
    ) as IMarketWidgetEditorState;
  },
  async refreshEditorState(editorSession) {
    const nativeModule = getNativeModule();
    if (platformEnv.isNativeAndroid || editorSession) {
      if (!editorSession || !nativeModule?.refreshWidgetEditorState) {
        return marketWidget.getEditorState(editorSession);
      }
      return JSON.parse(
        await nativeModule.refreshWidgetEditorState(editorSession),
      ) as IMarketWidgetEditorState;
    }
    if (
      !(
        marketWidget.supportsSettingsEditing() ||
        marketWidget.supportsProfileEditing()
      ) ||
      !nativeModule?.refreshEditorState
    ) {
      return marketWidget.getEditorState();
    }
    return JSON.parse(
      await nativeModule.refreshEditorState(),
    ) as IMarketWidgetEditorState;
  },
  async searchStocks(query, editorSession) {
    const nativeModule = getNativeModule();
    if (platformEnv.isNativeAndroid || editorSession) {
      if (!editorSession || !nativeModule?.searchWidgetStocks) {
        return marketWidget.getEditorState(editorSession);
      }
      return JSON.parse(
        await nativeModule.searchWidgetStocks(editorSession, query),
      ) as IMarketWidgetEditorState;
    }
    if (!nativeModule?.searchStocks) return marketWidget.getEditorState();
    return JSON.parse(
      await nativeModule.searchStocks(query),
    ) as IMarketWidgetEditorState;
  },
  async saveProfile(profile) {
    const nativeModule = getNativeModule();
    if (!marketWidget.supportsProfileEditing() || !nativeModule?.saveProfile) {
      throw new OneKeyLocalError(
        'Market widget profile editing is unavailable',
      );
    }
    return JSON.parse(
      await nativeModule.saveProfile(JSON.stringify(profile)),
    ) as IMarketWidgetProfile;
  },
  async finishEditing(editorSession, saved) {
    await getNativeModule()?.finishWidgetEditing?.(editorSession, saved);
  },
  async saveSettings(settings, editorSession) {
    const nativeModule = getNativeModule();
    if (platformEnv.isNativeAndroid || editorSession) {
      if (!editorSession || !nativeModule?.saveWidgetSettings) {
        throw new OneKeyLocalError(
          'Market widget editor session is unavailable',
        );
      }
      return JSON.parse(
        await nativeModule.saveWidgetSettings(
          editorSession,
          JSON.stringify(settings),
        ),
      ) as IMarketWidgetProfile;
    }
    if (
      !marketWidget.supportsSettingsEditing() ||
      !nativeModule?.saveSettings
    ) {
      throw new OneKeyLocalError('Market widget settings are unavailable');
    }
    return JSON.parse(
      await nativeModule.saveSettings(JSON.stringify(settings)),
    ) as IMarketWidgetProfile;
  },
};

export default marketWidget;
