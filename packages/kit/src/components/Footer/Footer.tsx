import { useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  ActionList,
  Icon,
  SizableText,
  XStack,
  useOnRouterChange,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { showIntercom } from '@onekeyhq/shared/src/modules3rdParty/intercom';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ERootRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import { PerpFooterTicker } from '../../views/Perp/components/FooterTicker/PerpFooterTicker';
import { PerpsProviderMirror } from '../../views/Perp/PerpsProviderMirror';
import { NetworkStatus } from '../NetworkStatus';
import { PerpRefreshButton } from '../PerpRefreshButton';

import { FooterLink } from './components/FooterLink';
import { FooterNavigation } from './components/FooterNavigation';

const PERP_TELEGRAM_URL = 'https://t.me/OneKeyPerps';

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

export function PerpFooterActions() {
  const intl = useIntl();
  const links = useMemo(() => getLinks(), []);

  const menuTrigger = useMemo(
    () => (
      <Icon
        name="DotHorOutline"
        size="$5"
        color="$iconSubdued"
        cursor="pointer"
        hoverStyle={{ color: '$icon' }}
      />
    ),
    [],
  );

  return (
    <>
      <XStack
        alignItems="center"
        gap="$1"
        cursor="pointer"
        flexShrink={0}
        hoverStyle={{ opacity: 0.6 }}
        onPress={() => openUrlExternal(PERP_TELEGRAM_URL)}
      >
        <Icon name="TelegramBrand" size="$4" color="$iconSubdued" />
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.perps_footer_help_us_better,
          })}
        </SizableText>
      </XStack>
      <ActionList
        title={intl.formatMessage({ id: ETranslations.global_more })}
        renderTrigger={menuTrigger}
        sections={[
          {
            items: links.map((item) => ({
              label: intl.formatMessage({ id: item.translationKey }),
              onPress: () => {
                if (item.onPress) {
                  item.onPress();
                } else if (item.href) {
                  openUrlExternal(item.href);
                }
              },
            })),
          },
        ]}
      />
    </>
  );
}

export function Footer() {
  const intl = useIntl();
  const [currentTab, setCurrentTab] = useState<ETabRoutes | null>(null);

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

  const links = useMemo(() => getLinks(), []);

  const linkItems = useMemo(
    () =>
      links.map((item) => (
        <FooterLink
          key={item.id}
          label={intl.formatMessage({ id: item.translationKey })}
          href={item.href}
          onPress={item.onPress}
        />
      )),
    [intl, links],
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
      <XStack gap="$2" alignItems="center" flexShrink={0}>
        <NetworkStatus />
        {isInPerpRoute ? (
          <PerpsProviderMirror>
            <PerpRefreshButton />
          </PerpsProviderMirror>
        ) : null}
      </XStack>

      {isInPerpRoute ? (
        <PerpsProviderMirror>
          <PerpFooterTicker />
        </PerpsProviderMirror>
      ) : null}

      <XStack gap="$3" alignItems="center" flexShrink={0}>
        {isInPerpRoute ? (
          <PerpFooterActions />
        ) : (
          <FooterNavigation>{linkItems}</FooterNavigation>
        )}
      </XStack>
    </XStack>
  );
}
