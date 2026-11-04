import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  buildHardwareShopInviteUrl,
  buildReferralLinks,
  getProductReferralLink,
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

  it('extracts only the code pathname segment when the invite URL has a query or hash', () => {
    const inviteUrl = 'https://onekey.so/r/HTSEO7?a=1&b=2#details';
    expect(
      buildReferralLinks({
        inviteUrl,
        webAppUrl: 'https://app.onekey.so',
      }).map(({ url }) => url),
    ).toEqual([
      'https://onekey.so/r/HTSEO7/shop?a=1&b=2#details',
      'https://app.onekey.so/r/HTSEO7/app/perps',
      'https://app.onekey.so/r/HTSEO7/app/swap',
      'https://app.onekey.so/r/HTSEO7/app/defi',
    ]);
    expect(buildHardwareShopInviteUrl(inviteUrl)).toBe(
      'https://onekey.so/r/HTSEO7/shop?a=1&b=2#details',
    );
  });
});

describe('getProductReferralLink', () => {
  it('links each activity hub to its product page as the link menu does', () => {
    expect(
      getProductReferralLink({
        source: 'Perps',
        inviteCode: 'CODE1',
        webAppUrl: 'https://app.onekey.so',
      }),
    ).toEqual({
      url: 'https://app.onekey.so/r/CODE1/app/perps',
      descId: ETranslations.referral_link_perps_desc,
    });
    expect(
      getProductReferralLink({
        source: 'Swap',
        inviteCode: 'CODE1',
        webAppUrl: 'https://app.onekey.so',
      }).descId,
    ).toBe(ETranslations.swap_referral_link__desc);
    expect(
      getProductReferralLink({
        source: 'Earn',
        inviteCode: 'CODE1',
        webAppUrl: 'https://app.onekey.so',
      }).url,
    ).toBe('https://app.onekey.so/r/CODE1/app/defi');
  });
});
