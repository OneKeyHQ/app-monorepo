import { GoogleSignin } from '@react-native-google-signin/google-signin';

import type { IGooglePlayService } from './googlePlayServiceTypes';

let hasPlayServices: boolean | null = null;
const googlePlayService: IGooglePlayService = {
  async isAvailable(): Promise<boolean> {
    if (hasPlayServices !== null) {
      return hasPlayServices;
    }
    try {
      hasPlayServices = await GoogleSignin.hasPlayServices({
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
