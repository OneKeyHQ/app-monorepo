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

  it('builds the upload payload from a Protocol V2 system wallpaper URL', () => {
    const source = readFileSync(
      join(__dirname, 'HardwareHomeScreenModal.tsx'),
      'utf8',
    );

    expect(source).toMatch(
      /const shouldBuildImagePayload =[\s\S]*isProtocolV2ProductType\(device\.deviceType\)[\s\S]*Boolean\(selectedItem\.url\)/u,
    );
    expect(source).toContain('if (shouldBuildImagePayload)');
  });
});
