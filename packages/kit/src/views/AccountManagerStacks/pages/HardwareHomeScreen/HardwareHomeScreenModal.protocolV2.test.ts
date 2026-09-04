import { readFileSync } from 'fs';
import { join } from 'path';

describe('HardwareHomeScreenModal Protocol V2 wallpapers', () => {
  it('shows default wallpapers for Pro2 and Neo', () => {
    const source = readFileSync(
      join(__dirname, 'HardwareHomeScreenModal.tsx'),
      'utf8',
    );

    expect(source).toMatch(
      /const shouldShowDefaultWallpapers =[\s\S]*isProtocolV2ProductType\(deviceInfo\.deviceType\)/u,
    );
    expect(source).toContain(
      'defaultWallpapers.length > 0 && shouldShowDefaultWallpapers',
    );
  });

  it('closes the wallpaper page after applying a wallpaper', () => {
    const source = readFileSync(
      join(__dirname, 'HardwareHomeScreenModal.tsx'),
      'utf8',
    );

    expect(source).toMatch(
      /await backgroundApiProxy\.serviceHardware\.setDeviceHomeScreen\([\s\S]*close\(\);[\s\S]*Toast\.success/u,
    );
  });
});
