import { parseReferralLandingUrl } from '../referralLandingLink';

describe('parseReferralLandingUrl', () => {
  it('parses supported OneKey referral landing URLs', () => {
    expect(parseReferralLandingUrl('https://onekey.so/r/R7EKUT')).toEqual({
      code: 'R7EKUT',
      page: '',
    });
    expect(
      parseReferralLandingUrl('https://app.onekey.so/r/R7EKUT/app/defi'),
    ).toEqual({
      code: 'R7EKUT',
      page: 'defi',
    });
    expect(
      parseReferralLandingUrl('https://app.onekey.so/r/R7EKUT/app/perps'),
    ).toEqual({
      code: 'R7EKUT',
      page: 'perps',
    });
    expect(parseReferralLandingUrl('https://onekeytest.com/r/KJWFWE')).toEqual({
      code: 'KJWFWE',
      page: '',
    });
    expect(
      parseReferralLandingUrl('https://app.onekeytest.com/r/KJWFWE/app/defi'),
    ).toEqual({
      code: 'KJWFWE',
      page: 'defi',
    });
  });

  it('supports user input without an explicit protocol', () => {
    expect(parseReferralLandingUrl('onekey.so/r/R7EKUT')).toEqual({
      code: 'R7EKUT',
      page: '',
    });
  });

  it('supports OneKey referral links from OneKey-owned host suffixes', () => {
    expect(
      parseReferralLandingUrl('https://wallet.onekeytest.com/r/KJWFWE'),
    ).toEqual({
      code: 'KJWFWE',
      page: '',
    });
  });

  it('rejects unsupported hosts and paths', () => {
    expect(parseReferralLandingUrl('https://evil.example/r/R7EKUT')).toBe(
      undefined,
    );
    expect(parseReferralLandingUrl('https://onekey.so/not-r/R7EKUT')).toBe(
      undefined,
    );
    expect(
      parseReferralLandingUrl('https://onekey.so/r/R7EKUT/app/perps/x'),
    ).toBe(undefined);
  });
});
