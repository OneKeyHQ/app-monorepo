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
  end: getStatus,
};

export default liveActivity;
