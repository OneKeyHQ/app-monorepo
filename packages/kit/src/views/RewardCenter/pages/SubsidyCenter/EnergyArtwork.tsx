import { Image } from '@onekeyhq/components';

import energyOrbit from './assets/energy-orbit-matte.png';

export function EnergyArtwork() {
  return (
    <Image
      source={energyOrbit}
      width="100%"
      height="100%"
      contentFit="contain"
      accessible={false}
    />
  );
}
