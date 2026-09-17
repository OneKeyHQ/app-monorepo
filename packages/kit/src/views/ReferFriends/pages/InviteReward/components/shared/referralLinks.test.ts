import { ETranslations } from '@onekeyhq/shared/src/locale';

import { buildReferralLinks } from './referralLinks';

describe('buildReferralLinks', () => {
  // Swap must use its own title instead of the legacy Trade one.
  it('keeps hardware, perps, swap, then defi order', () => {
    expect(
      buildReferralLinks({
        inviteUrl: 'https://onekey.so/r/ABC123',
        webAppUrl: 'https://app.onekey.so',
      }).map(({ titleId, pathSuffix }) => [titleId, pathSuffix]),
    ).toEqual([
      [ETranslations.referral_link_hw_title, '/shop'],
      [ETranslations.referral_link_perps_title, '/app/perps'],
      [ETranslations.swap_referral_link__title, '/app/swap'],
      [ETranslations.referral_link_defi_title, '/app/defi'],
    ]);
  });
});
