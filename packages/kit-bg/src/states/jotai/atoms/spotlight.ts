import {
  ESpotlightTour,
  type ISpotlightData,
} from '@onekeyhq/shared/src/spotlight';

import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

export const { target: spotlightPersistAtom, use: useSpotlightPersistAtom } =
  globalAtom<ISpotlightData>({
    persist: true,
    name: EAtomNames.spotlightPersistAtom,
    initialValue: {
      data: {
        [ESpotlightTour.createAllNetworks]: 0,
        [ESpotlightTour.oneKeyProBanner]: 0,
        [ESpotlightTour.switchDappAccount]: 0,
        [ESpotlightTour.allNetworkAccountValue]: 0,
        [ESpotlightTour.showFloatingIconDialog]: 0,
        [ESpotlightTour.referAFriend]: 0,
        [ESpotlightTour.hardwareSalesRewardAlert]: 0,
        [ESpotlightTour.earnRewardAlert]: 0,
        [ESpotlightTour.allNetworksInfo]: 0,
        [ESpotlightTour.earnRewardHistory]: 0,
        [ESpotlightTour.showDevelopmentBuildWarningDialog]: 0,
      },
    },
  });
