import {
  TWITTER_FOLLOW_URL,
  TWITTER_FOLLOW_URL_CN,
} from '@onekeyhq/shared/src/config/appConfig';

import { getTwitterFollowUrl } from './officialChannels';

describe('official channels locale projection', () => {
  it.each(['zh-CN', 'zh-HK', 'zh-TW', 'zh_CN'])(
    'uses the Chinese X URL for %s',
    (locale) => {
      expect(getTwitterFollowUrl(locale)).toBe(TWITTER_FOLLOW_URL_CN);
    },
  );

  it('uses the global X URL for other locales', () => {
    expect(getTwitterFollowUrl('en-US')).toBe(TWITTER_FOLLOW_URL);
  });
});
