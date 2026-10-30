import { NativeModules, Platform } from 'react-native';

import { OneKeyLocalError } from '../../errors';
import platformEnv from '../../platformEnv';

import type {
  IMarketWidgetEditorState,
  IMarketWidgetModule,
  IMarketWidgetProfile,
} from './types';

type IOneKeyMarketWidgetNativeModule = {
  setConfiguration: (configuration: string) => Promise<void>;
  getEditorState?: () => Promise<string>;
  saveProfile?: (profile: string) => Promise<string>;
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
  supportsProfileEditing: () =>
    !!platformEnv.isNativeIOS &&
    Number.parseInt(String(Platform.Version), 10) >= 17 &&
    typeof getNativeModule()?.getEditorState === 'function' &&
    typeof getNativeModule()?.saveProfile === 'function',
  async setConfiguration(configuration) {
    await getNativeModule()?.setConfiguration(JSON.stringify(configuration));
  },
  async getEditorState() {
    const nativeModule = getNativeModule();
    if (
      !marketWidget.supportsProfileEditing() ||
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
};

export default marketWidget;
