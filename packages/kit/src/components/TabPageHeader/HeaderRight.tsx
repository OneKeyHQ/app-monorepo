import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { useIsIpadLandscape, useMedia } from '@onekeyhq/components';
import {
  HeaderButtonGroup,
  HeaderIconButton,
} from '@onekeyhq/components/src/layouts/Navigation/Header';
import { NetworkSelectorTriggerHome } from '@onekeyhq/kit/src/components/AccountSelector/NetworkSelectorTrigger';
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

export function HeaderRight({
  tabRoute,
}: {
  sceneName: EAccountSelectorSceneName;
  tabRoute: ETabRoutes;
}) {
  const { gtMd } = useMedia();
  const isIpadLandscape = useIsIpadLandscape();
  const isWideScreen =
    !platformEnv.isNativeAndroid && (gtMd || isIpadLandscape);
  const items = useMemo(() => {
    const fixedItems = (
      <>
        <MoreAction />
        {isWideScreen ? <PeopleAction /> : null}
      </>
    );
    switch (tabRoute) {
      case ETabRoutes.Home:
        return (
          <>
            {isWideScreen ? undefined : <SelectorTrigger />}
            {fixedItems}
          </>
        );
      case ETabRoutes.Swap:
      case ETabRoutes.Market:
        return fixedItems;
      case ETabRoutes.Discovery:
        return (
          <>
            <HistoryIconButton />
            {isWideScreen ? undefined : (
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
  }, [isWideScreen, tabRoute]);
  return (
    <HeaderButtonGroup
      testID="Wallet-Page-Header-Right"
      className="app-region-no-drag"
    >
      {items}
    </HeaderButtonGroup>
  );
}
