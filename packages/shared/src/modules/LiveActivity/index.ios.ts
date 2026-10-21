import { NativeModules } from 'react-native';

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
  end: (orderKey) => nativeModule?.end(orderKey) ?? unavailable(),
};

export default liveActivity;
