import { NativeModules, Platform } from 'react-native';

import { OneKeyLocalError } from '../../errors';
import platformEnv from '../../platformEnv';

import type {
  IMarketWidgetEditorState,
  IMarketWidgetModule,
  IMarketWidgetProfile,
} from './types';

type IOneKeyMarketWidgetNativeModule = {
  stockSupportVersion?: number;
  setConfiguration: (configuration: string) => Promise<void>;
  getEditorState?: () => Promise<string>;
  refreshEditorState?: () => Promise<string>;
  saveProfile?: (profile: string) => Promise<string>;
  saveSettings?: (settings: string) => Promise<string>;
  getWidgetEditorState?: (session: string) => Promise<string>;
  refreshWidgetEditorState?: (session: string) => Promise<string>;
  saveWidgetSettings?: (session: string, settings: string) => Promise<string>;
  finishWidgetEditing?: (session: string, saved: boolean) => Promise<void>;
};

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
    await getNativeModule()?.setConfiguration(JSON.stringify(configuration));
  },
  async getEditorState(editorSession) {
    const nativeModule = getNativeModule();
    if (platformEnv.isNativeAndroid) {
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
    if (platformEnv.isNativeAndroid) {
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
    if (platformEnv.isNativeAndroid) {
      await getNativeModule()?.finishWidgetEditing?.(editorSession, saved);
    }
  },
  async saveSettings(settings, editorSession) {
    const nativeModule = getNativeModule();
    if (platformEnv.isNativeAndroid) {
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
