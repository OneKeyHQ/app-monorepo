import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  buildHardwareShopInviteUrl,
  buildReferralLinks,
} from './referralLinks';

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
      [ETranslations.perps_perps, '/app/perps'],
      [ETranslations.global_swap, '/app/swap'],
      [ETranslations.referral_link_defi_title, '/app/defi'],
    ]);
  });

  it('builds the hardware shop link from the invite URL', () => {
    expect(buildHardwareShopInviteUrl('https://onekey.so/r/ABC123')).toBe(
      'https://onekey.so/r/ABC123/shop',
    );
  });

  it('returns no shop link when the invite URL is missing', () => {
    expect(buildHardwareShopInviteUrl('')).toBe('');
  });
});
