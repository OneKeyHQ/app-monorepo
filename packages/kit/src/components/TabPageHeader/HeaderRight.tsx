import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { useIsHorizontalLayout, useMedia } from '@onekeyhq/components';
import {
  HeaderButtonGroup,
  HeaderIconButton,
} from '@onekeyhq/components/src/layouts/Navigation/Header';
import { NetworkSelectorTriggerHome } from '@onekeyhq/kit/src/components/AccountSelector/NetworkSelectorTrigger';
import { UniversalSearchInput } from '@onekeyhq/kit/src/components/TabPageHeader/UniversalSearchInput';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes/tab';
import type { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { useLoginOneKeyId } from '../../hooks/useLoginOneKeyId';
import { useReferFriends } from '../../hooks/useReferFriends';
import TabCountButton from '../../views/Discovery/components/MobileBrowser/TabCountButton';
import { HistoryIconButton } from '../../views/Discovery/pages/components/HistoryIconButton';

import { MoreActionButton } from './MoreActionButton';

function GiftAction() {
  const { shareReferRewards } = useReferFriends();
  const handleShareReferRewards = useCallback(() => {
    void shareReferRewards();
  }, [shareReferRewards]);
  const intl = useIntl();
  return (
    <HeaderIconButton
      title={intl.formatMessage({ id: ETranslations.referral_title })}
      icon="GiftOutline"
      onPress={handleShareReferRewards}
    />
  );
}

function MoreAction() {
  return <MoreActionButton key="more-action" />;
}

function SelectorTrigger() {
  return (
    <NetworkSelectorTriggerHome
      num={0}
      size="small"
      recordNetworkHistoryEnabled
    />
  );
}

function PeopleAction() {
  const { loginOneKeyId } = useLoginOneKeyId();
  const handlePress = useCallback(async () => {
    await loginOneKeyId({ toOneKeyIdPageOnLoginSuccess: true });
  }, [loginOneKeyId]);
  return (
    <HeaderIconButton
      key="onekey-id"
      title="OneKey ID"
      icon="PeopleOutline"
      onPress={handlePress}
      testID="header-right-onekey-id"
    />
  );
}

function SearchInput() {
  const { gtLg } = useMedia();
  return <UniversalSearchInput size={gtLg ? 'large' : 'small'} />;
}

export function HeaderRight({
  tabRoute,
}: {
  sceneName: EAccountSelectorSceneName;
  tabRoute: ETabRoutes;
}) {
  const isHorizontal = useIsHorizontalLayout();
  const items = useMemo(() => {
    const fixedItems = (
      <>
        <MoreAction />
        {isHorizontal ? <PeopleAction /> : null}
      </>
    );
    switch (tabRoute) {
      case ETabRoutes.Home:
        return (
          <>
            {isHorizontal ? <SearchInput /> : undefined}
            {isHorizontal ? undefined : <SelectorTrigger />}
            {fixedItems}
          </>
        );
      case ETabRoutes.Swap:
        return fixedItems;
      case ETabRoutes.Market:
        return (
          <>
            {isHorizontal ? <SearchInput /> : undefined}
            {fixedItems}
          </>
        );
      case ETabRoutes.Discovery:
        return (
          <>
            <HistoryIconButton />
            {isHorizontal ? undefined : (
              <TabCountButton testID="browser-header-tabs" />
            )}
            {fixedItems}
          </>
        );
      case ETabRoutes.Earn:
        return (
          <>
            <GiftAction />
            {fixedItems}
          </>
        );
      default:
        break;
    }
  }, [isHorizontal, tabRoute]);
  return (
    <HeaderButtonGroup
      testID="Wallet-Page-Header-Right"
      className="app-region-no-drag"
      width={platformEnv.isNative ? undefined : '100%'}
      jc={platformEnv.isNative ? undefined : 'flex-end'}
    >
      {items}
    </HeaderButtonGroup>
  );
}
