import { Image } from '@onekeyhq/components';

// 720px WebP: three times the largest size the artwork is drawn at on phones
// (240pt); the desktop panel draws it at 280pt on 2x screens.
import energyOrbit from './assets/energy-orbit-matte.webp';

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
