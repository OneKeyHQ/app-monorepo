import { GoogleSignin } from '@react-native-google-signin/google-signin';

import type { IGooglePlayService } from './googlePlayServiceTypes';

const googlePlayService: IGooglePlayService = {
  isAvailable: async () => {
    try {
      const hasPlayServices = await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: false,
      });
      console.log(
        'googlePlayService: isAvailable result >>>>> ',
        hasPlayServices,
      );
      return hasPlayServices;
    } catch (e) {
      console.error('googlePlayService: isAvailable error >>>>> ', e);
      return false;
    }
  },
};

export default googlePlayService;
