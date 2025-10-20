import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { NetworkStatus } from '../NetworkStatus';

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
      <NetworkStatus />
      <FooterNavigation>{linkItems}</FooterNavigation>
    </XStack>
  );
}
