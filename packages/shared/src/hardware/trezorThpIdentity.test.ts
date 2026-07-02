import {
  TREZOR_THP_APP_NAME,
  getTrezorThpHostName,
  getTrezorThpIdentity,
} from './trezorThpIdentity';

describe('trezorThpIdentity', () => {
  it('keeps the THP app name stable', () => {
    expect(TREZOR_THP_APP_NAME).toBe('OneKey Wallet');
    expect(getTrezorThpIdentity({ isDesktop: true })).toEqual({
      appName: 'OneKey Wallet',
      hostName: 'Desktop',
    });
  });

  it('uses non-sensitive platform host names instead of the OneKey brand', () => {
    expect(getTrezorThpHostName({ isDesktop: true })).toBe('Desktop');
    expect(getTrezorThpHostName({ isExtension: true })).toBe('Extension');
    expect(getTrezorThpHostName({ isNative: true })).toBe('Mobile');
    expect(getTrezorThpHostName({ isWeb: true })).toBe('Web');
    expect(getTrezorThpHostName({})).toBe('Device');
  });
});
