import { useCallback, useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';

import {
  NativeHomeTabs,
  Page,
  SizableText,
  Stack,
  useScrollContentTabBarOffset,
} from '@onekeyhq/components';
import type {
  IHomeNativeSchema,
  INativeHomeTabsRef,
} from '@onekeyhq/components';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import type { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { NetworkAlert } from '../../../components/NetworkAlert';
import { RiskApprovalAlert } from '../../../components/RiskApprovalAlert';
import { TabPageHeader } from '../../../components/TabPageHeader';
import { WatchOnlyAlert } from '../../../components/WatchOnlyAlert';

import { HomeHeaderContainer } from './HomeHeaderContainer';
import { homePageContentMaxWidthSx } from './homePageContentMaxWidth';

import type { NativeSyntheticEvent } from 'react-native';

type IHomeNativePageViewProps = {
  onPressHide?: () => void;
  sceneName: EAccountSelectorSceneName;
};

type IHomeNativeRefreshEvent = {
  tabKey: string;
};

export function HomeNativePageView({ sceneName }: IHomeNativePageViewProps) {
  const intl = useIntl();
  const tabBarHeight = useScrollContentTabBarOffset();
  const nativeTabsRef = useRef<INativeHomeTabsRef>(null);

  const schema = useMemo<IHomeNativeSchema>(
    () => ({
      version: 1,
      schemaId: 'home-native-shell-v1',
      activeTabKey: 'portfolio',
      tabs: [
        {
          key: 'portfolio',
          title: intl.formatMessage({
            id: ETranslations.dexmarket_spot,
          }),
          enabled: true,
        },
        {
          key: 'defi',
          title: intl.formatMessage({
            id: ETranslations.global_earn,
          }),
          enabled: true,
        },
        {
          key: 'nft',
          title: intl.formatMessage({
            id: ETranslations.global_nft,
          }),
          enabled: true,
        },
        {
          key: 'history',
          title: intl.formatMessage({
            id: ETranslations.global_history,
          }),
          enabled: true,
        },
      ],
      rowsByTab: {
        portfolio: [
          {
            type: 'sectionHeader',
            key: 'portfolio:tokens:title',
            title: intl.formatMessage({
              id: ETranslations.global_universal_search_tabs_tokens,
            }),
          },
          {
            type: 'text',
            key: 'portfolio:native-shell-ready',
            title: 'Native Home shell',
            subtitle:
              'Scroll, tab switching, and native row rendering are mounted.',
          },
          {
            type: 'rnSlot',
            key: 'portfolio:rn-slot:summary',
            slotId: 'portfolio-summary',
            reuse: 'never',
            estimatedHeight: 84,
          },
          {
            type: 'loading',
            key: 'portfolio:tokens:loading',
            rows: 4,
          },
        ],
        defi: [
          {
            type: 'text',
            key: 'defi:native-placeholder',
            title: 'DeFi native tab',
            subtitle: 'DeFi rows will be mapped into this native list.',
          },
        ],
        nft: [
          {
            type: 'text',
            key: 'nft:native-placeholder',
            title: 'NFT native tab',
            subtitle: 'NFT rows will be mapped into this native list.',
          },
        ],
        history: [
          {
            type: 'text',
            key: 'history:native-placeholder',
            title: 'History native tab',
            subtitle: 'History pagination will be connected here.',
          },
        ],
      },
      refreshingByTab: {},
      hasMoreByTab: {},
      tabBar: {
        variant: 'pill',
        showSettingsButton: true,
      },
    }),
    [intl],
  );

  const handleRefresh = useCallback(
    (event: NativeSyntheticEvent<IHomeNativeRefreshEvent>) => {
      appEventBus.emit(EAppEventBusNames.AccountDataUpdate, undefined);
      defaultLogger.account.wallet.walletPullToRefresh();
      globalThis.setTimeout(() => {
        nativeTabsRef.current?.endRefreshing(event.nativeEvent.tabKey);
      }, 350);
    },
    [],
  );

  return (
    <Page fullPage>
      <Page.Body>
        <Page.Container flex={1} padded={false}>
          <TabPageHeader sceneName={sceneName} tabRoute={ETabRoutes.Home} />
          <Stack {...homePageContentMaxWidthSx}>
            <RiskApprovalAlert />
            <WatchOnlyAlert />
            <NetworkAlert />
          </Stack>
          <NativeHomeTabs
            ref={nativeTabsRef}
            schema={schema}
            bottomInset={tabBarHeight}
            enableHorizontalSwipe
            onRefresh={handleRefresh}
          >
            <NativeHomeTabs.Header>
              <Stack {...homePageContentMaxWidthSx}>
                <HomeHeaderContainer />
              </Stack>
            </NativeHomeTabs.Header>
            <NativeHomeTabs.Slot slotId="portfolio-summary">
              <Stack {...homePageContentMaxWidthSx} px="$5" py="$2.5">
                <Stack
                  borderRadius="$2"
                  bg="$bgSubdued"
                  px="$4"
                  py="$3"
                  minHeight="$16"
                  justifyContent="center"
                >
                  <SizableText size="$bodyMdMedium">
                    RN slot row rendered inside the native list
                  </SizableText>
                </Stack>
              </Stack>
            </NativeHomeTabs.Slot>
          </NativeHomeTabs>
        </Page.Container>
      </Page.Body>
    </Page>
  );
}
