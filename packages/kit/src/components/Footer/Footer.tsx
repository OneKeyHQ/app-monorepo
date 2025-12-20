import { useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Image, XStack, useOnRouterChange } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { showIntercom } from '@onekeyhq/shared/src/modules3rdParty/intercom';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ERootRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';

import { usePerpsLogo } from '../../views/Perp/hooks/usePerpsLogo';
import { PerpsProviderMirror } from '../../views/Perp/PerpsProviderMirror';
import { NetworkStatus } from '../NetworkStatus';
import { PerpRefreshButton } from '../PerpRefreshButton';

import { FooterLink } from './components/FooterLink';
import { FooterNavigation } from './components/FooterNavigation';

const getLinks = () => [
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
  platformEnv.isWebDappMode
    ? {
        id: 'contact',
        translationKey: ETranslations.settings_contact_us,
        onPress: () => {
          void showIntercom();
        },
      }
    : {
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
  const [currentTab, setCurrentTab] = useState<ETabRoutes | null>(null);
  const { poweredByHyperliquidLogo } = usePerpsLogo();

  useOnRouterChange((state) => {
    if (!state) {
      setCurrentTab(ETabRoutes.Home);
      return;
    }
    const rootState = state?.routes.find(
      ({ name }) => name === ERootRoutes.Main,
    )?.state;
    const currentTabName = rootState?.routeNames
      ? (rootState?.routeNames?.[rootState?.index || 0] as ETabRoutes)
      : (rootState?.routes[0].name as ETabRoutes);
    setCurrentTab(currentTabName);
  });

  const linkItems = useMemo(
    () =>
      getLinks().map((item) => (
        <FooterLink
          key={item.id}
          label={intl.formatMessage({ id: item.translationKey })}
          href={item.href}
          onPress={item.onPress}
        />
      )),
    [intl],
  );

  if (currentTab === ETabRoutes.WebviewPerpTrade) {
    return null;
  }

  const isInPerpRoute = currentTab === ETabRoutes.Perp;

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
      <XStack gap="$2" alignItems="center">
        <NetworkStatus />
        {isInPerpRoute ? (
          <PerpsProviderMirror>
            <PerpRefreshButton />
          </PerpsProviderMirror>
        ) : null}
      </XStack>

      <XStack gap="$3" alignItems="center">
        <FooterNavigation>{linkItems}</FooterNavigation>

        {isInPerpRoute ? (
          <Image
            source={poweredByHyperliquidLogo}
            w={145}
            h={25}
            resizeMode="contain"
          />
        ) : null}
      </XStack>
    </XStack>
  );
}
