import serviceHardwareUtils from './serviceHardwareUtils';

describe('serviceHardwareUtils', () => {
  it('keeps identifier suffixes for logs', () => {
    expect(serviceHardwareUtils.maskLogIdentifier('PR1234567890')).toBe(
      '***7890',
    );
    expect(serviceHardwareUtils.maskLogIdentifier(undefined)).toBeUndefined();
  });
});
