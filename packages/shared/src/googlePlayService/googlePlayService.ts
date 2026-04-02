import type { IGooglePlayService } from './googlePlayServiceTypes';

const googlePlayService: IGooglePlayService = {
  isAvailable: () => Promise.resolve(false),
};

export default googlePlayService;
