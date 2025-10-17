import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { NetworkStatusBadge } from '@onekeyhq/components/src/content/NetworkStatusBadge';
import { useNetInfo } from '@onekeyhq/components/src/hooks/useNetInfo';
import { XStack } from '@onekeyhq/components/src/primitives';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { FooterLink } from './components/FooterLink';
import { FooterNavigation } from './components/FooterNavigation';

const LINKS = [
  {
    id: 'about',
    translationKey: ETranslations.global_about,
    href: 'https://help.onekey.so/articles/11461135',
  },
  {
    id: 'docs',
    translationKey: ETranslations.menu_help,
    href: 'https://help.onekey.so/collections/15988402',
  },
  {
    id: 'guide',
    translationKey: ETranslations.global_view_tutorial,
    href: 'https://help.onekey.so/articles/12568192',
  },
  {
    id: 'terms',
    translationKey: ETranslations.settings_user_agreement,
    href: 'https://help.onekey.so/articles/11461292',
  },
  {
    id: 'privacy',
    translationKey: ETranslations.settings_privacy_policy,
    href: 'https://help.onekey.so/articles/11461298',
  },
];

export function Footer() {
  const intl = useIntl();
  const { isInternetReachable } = useNetInfo();

  const linkItems = useMemo(
    () =>
      LINKS.map((item) => (
        <FooterLink
          key={item.id}
          label={intl.formatMessage({ id: item.translationKey })}
          href={item.href}
        />
      )),
    [intl],
  );

  return (
    <XStack
      width="100%"
      px="$2"
      py="$2"
      borderTopWidth={1}
      borderTopColor="$borderSubdued"
      bg="$bgApp"
      gap="$2"
      alignItems="center"
      justifyContent="space-between"
    >
      <NetworkStatusBadge
        connected={isInternetReachable !== false}
        badgeSize="sm"
        labelFontSize={13}
      />
      <FooterNavigation>{linkItems}</FooterNavigation>
    </XStack>
  );
}
