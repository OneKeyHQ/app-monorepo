import { NativeModules } from 'react-native';

import platformEnv from '../../platformEnv';

import type { IMarketWidgetModule } from './types';

type IOneKeyMarketWidgetNativeModule = {
  setConfiguration: (configuration: string) => Promise<void>;
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
  async setConfiguration(configuration) {
    await getNativeModule()?.setConfiguration(JSON.stringify(configuration));
  },
};

export default marketWidget;
