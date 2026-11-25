import type { ILiveActivityModule } from '../../../types/liveActivity';

const getStatus: ILiveActivityModule['getStatus'] = async () => ({
  supported: false,
  enabled: false,
  activities: [],
});

const liveActivity: ILiveActivityModule = {
  getStatus,
  start: getStatus,
  update: getStatus,
  updateStrings: getStatus,
  end: getStatus,
  clearTracking: getStatus,
};

export default liveActivity;
