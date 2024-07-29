import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { ESpotlightTour } from '@onekeyhq/shared/src/spotlight';

import { spotlightPersistAtom } from '../states/jotai/atoms/spotlight';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceSpotlight extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  public async updateTourTimes(tourName: ESpotlightTour) {
    await spotlightPersistAtom.set((prev) => {
      const { data } = prev;
      const tourTimes = data[tourName] || 0;
      return {
        ...prev,
        data: {
          ...data,
          [tourName]: tourTimes + 1,
        },
      };
    });
  }

  @backgroundMethod()
  public async reset() {
    await spotlightPersistAtom.set({
      data: {
        [ESpotlightTour.createAllNetworks]: 0,
        [ESpotlightTour.oneKeyProBanner]: 0,
      },
    });
  }
}

export default ServiceSpotlight;
