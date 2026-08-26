import {
  shouldRetryFirmwareVerification,
  shouldVerifyFirmwareHash,
} from './firmwareVerifyUtils';

describe('shouldVerifyFirmwareHash', () => {
  it('continues with hash verification after an official certificate', () => {
    expect(
      shouldVerifyFirmwareHash({
        certificateVerified: true,
        useNewProcess: true,
      }),
    ).toBe(true);
  });

  it('does not downgrade an unofficial certificate when hash data is unavailable', () => {
    expect(
      shouldVerifyFirmwareHash({
        certificateVerified: false,
        useNewProcess: true,
      }),
    ).toBe(false);
  });
});

describe('shouldRetryFirmwareVerification', () => {
  it('retries when hash verification is temporarily unavailable', () => {
    expect(
      shouldRetryFirmwareVerification({
        verificationTemporarilyUnavailable: true,
      }),
    ).toBe(true);
  });
});
