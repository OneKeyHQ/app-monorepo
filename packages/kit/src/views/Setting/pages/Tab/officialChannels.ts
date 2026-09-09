import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { IKeyOfIcons } from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  GITHUB_URL,
  INSTAGRAM_URL,
  ONEKEY_URL,
  REDDIT_URL,
  TWITTER_FOLLOW_URL,
  TWITTER_FOLLOW_URL_CN,
} from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { SettingTestIDs } from '../../testIDs';

export const OFFICIAL_CHANNELS_SEARCH_KEYWORDS = [
  'official',
  'website',
  'twitter',
  'github',
  'reddit',
  'instagram',
  'ins',
  '官方渠道',
  '官方网站',
  '官方網站',
  '官方管道',
] as const;

function isChineseLocale(locale?: string): boolean {
  const normalizedLocale = locale?.toLowerCase().replace('_', '-');
  return (
    normalizedLocale === 'zh' || Boolean(normalizedLocale?.startsWith('zh-'))
  );
}

export function getTwitterFollowUrl(locale?: string): string {
  return isChineseLocale(locale) ? TWITTER_FOLLOW_URL_CN : TWITTER_FOLLOW_URL;
}

export type IOfficialChannel = {
  id: string;
  icon: IKeyOfIcons;
  testID: string;
  title: string;
  url: string;
};

type IUseOfficialChannelsOptions = {
  includeMobileChannels?: boolean;
};

export function useOfficialChannels({
  includeMobileChannels = false,
}: IUseOfficialChannelsOptions = {}): IOfficialChannel[] {
  const intl = useIntl();
  const [{ locale }] = useSettingsPersistAtom();
  const websiteTitle = intl.formatMessage({
    id: ETranslations.global_official_website,
  });
  const xTitle = intl.formatMessage({
    id: ETranslations.official_channels_x__title,
  });
  const githubTitle = intl.formatMessage({ id: ETranslations.global_github });
  const redditTitle = intl.formatMessage({
    id: ETranslations.official_channels_reddit__title,
  });
  const instagramTitle = intl.formatMessage({
    id: ETranslations.official_channels_instagram__title,
  });
  const twitterFollowUrl = getTwitterFollowUrl(locale);

  return useMemo(
    () => [
      {
        id: 'official-website',
        icon: 'OnekeyBrand',
        testID: SettingTestIDs.socialOnekeyWebsiteBtn,
        title: websiteTitle,
        url: ONEKEY_URL,
      },
      {
        id: 'official-x',
        icon: 'Xbrand',
        testID: SettingTestIDs.socialXBtn,
        title: xTitle,
        url: twitterFollowUrl,
      },
      {
        id: 'official-github',
        icon: 'GithubBrand',
        testID: SettingTestIDs.socialGithubBtn,
        title: githubTitle,
        url: GITHUB_URL,
      },
      ...(includeMobileChannels
        ? [
            {
              id: 'official-reddit',
              icon: 'ChatGroupOutline' as const,
              testID: SettingTestIDs.socialRedditBtn,
              title: redditTitle,
              url: REDDIT_URL,
            },
            {
              id: 'official-instagram',
              icon: 'InstagramBrand' as const,
              testID: SettingTestIDs.socialInstagramBtn,
              title: instagramTitle,
              url: INSTAGRAM_URL,
            },
          ]
        : []),
    ],
    [
      githubTitle,
      includeMobileChannels,
      instagramTitle,
      redditTitle,
      twitterFollowUrl,
      websiteTitle,
      xTitle,
    ],
  );
}
