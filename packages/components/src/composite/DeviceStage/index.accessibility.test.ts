import { getCapsuleAccessibilityProps } from './accessibility';

describe('DeviceStage outcome accessibility', () => {
  it('announces the successful capsule without interrupting other steps', () => {
    expect(getCapsuleAccessibilityProps('done', 'Finished')).toEqual({
      accessible: true,
      accessibilityLabel: 'Finished',
      accessibilityLiveRegion: 'polite',
    });
    expect(getCapsuleAccessibilityProps('device', 'Working')).toEqual({
      accessible: false,
      accessibilityLabel: undefined,
      accessibilityLiveRegion: 'none',
    });
  });
});
