import { NativeModules } from 'react-native';

import { OneKeyLocalError } from '../../errors';

import type { ILiveActivityModule } from '../../../types/liveActivity';

const nativeModule = NativeModules.SwapLiveActivity as
  | ILiveActivityModule
  | undefined;

const unavailable: ILiveActivityModule['getStatus'] = async () => ({
  supported: false,
  enabled: false,
  activities: [],
});

const liveActivity: ILiveActivityModule = {
  getStatus: () => nativeModule?.getStatus() ?? unavailable(),
  start: (snapshot) => nativeModule?.start(snapshot) ?? unavailable(),
  update: (snapshot) => nativeModule?.update(snapshot) ?? unavailable(),
  updateStrings: (request) =>
    nativeModule?.updateStrings?.(request) ?? unavailable(),
  end: (orderKey) => nativeModule?.end(orderKey) ?? unavailable(),
  clearTracking: () => {
    if (!nativeModule) return unavailable();
    if (!nativeModule.clearTracking) {
      throw new OneKeyLocalError('Live Activity cleanup is unavailable');
    }
    return nativeModule.clearTracking();
  },
};

export default liveActivity;
