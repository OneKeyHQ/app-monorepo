import { readFileSync } from 'fs';
import { join } from 'path';

describe('DeviceSetup async lifecycle', () => {
  const source = readFileSync(join(__dirname, 'DeviceSetup.tsx'), 'utf8');

  it('invalidates legacy device checks after a newer run or page removal', () => {
    const checkStart = source.indexOf('const checkDeviceInitialized');
    const checkEnd = source.indexOf('const handleDeviceSetupDone');
    const checkSource = source.slice(checkStart, checkEnd);

    expect(source).toContain('checkDeviceRunIdRef');
    expect(checkSource).toContain('const isDeviceCheckStale');
    expect(
      checkSource.match(/if \(isDeviceCheckStale\(\)\)/g)?.length ?? 0,
    ).toBeGreaterThanOrEqual(4);
  });

  it('never schedules or completes final navigation after page removal', () => {
    const navigateStart = source.indexOf('const navigateToFinalize');
    const navigateEnd = source.indexOf('const pollPro2OnboardingStatus');
    const navigateSource = source.slice(navigateStart, navigateEnd);

    expect(navigateSource).toContain('!isPageActiveRef.current');
    expect(
      navigateSource.match(/!isPageActiveRef\.current/g)?.length ?? 0,
    ).toBeGreaterThanOrEqual(2);
  });
});
