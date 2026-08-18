import { ETranslations } from '@onekeyhq/shared/src/locale';

import { buildReferralLinks } from './referralLinks';

describe('buildReferralLinks', () => {
  it('keeps hardware, perps, swap, then defi order', () => {
    expect(
      buildReferralLinks({
        inviteUrl: 'https://onekey.so/r/ABC123',
        webAppUrl: 'https://app.onekey.so',
      }).map((link) => link.pathSuffix),
    ).toEqual(['/shop', '/app/perps', '/app/swap', '/app/defi']);
  });

  it('uses the Swap product name instead of Trade', () => {
    expect(
      buildReferralLinks({
        inviteUrl: 'https://onekey.so/r/ABC123',
        webAppUrl: 'https://app.onekey.so',
      }).map((link) => link.titleId),
    ).toEqual([
      ETranslations.referral_link_hw_title,
      ETranslations.referral_link_perps_title,
      ETranslations.swap_referral_link__title,
      ETranslations.referral_link_defi_title,
    ]);
  });
});
