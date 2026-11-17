import { ETranslations } from '@onekeyhq/shared/src/locale';

import { getActivityHubTitleId } from './layout';

describe('getActivityHubTitleId', () => {
  it('names the invite panel alone after inviting friends', () => {
    expect(
      getActivityHubTitleId({ hasCampaigns: false, showInvitePanel: true }),
    ).toBe(ETranslations.referral_home__title);
  });

  it('keeps the activity hub name once campaigns are listed', () => {
    expect(
      getActivityHubTitleId({ hasCampaigns: true, showInvitePanel: true }),
    ).toBe(ETranslations.perps_activity_hub);
    expect(
      getActivityHubTitleId({ hasCampaigns: true, showInvitePanel: false }),
    ).toBe(ETranslations.perps_activity_hub);
  });
});
