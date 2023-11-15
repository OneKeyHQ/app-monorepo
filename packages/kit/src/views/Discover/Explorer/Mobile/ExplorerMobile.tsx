import { useEffect, useState } from 'react';

import { Freeze } from 'react-freeze';

import { Stack } from '@onekeyhq/components';
import useSafeAreaInsets from '@onekeyhq/components/src/Provider/hooks/useSafeAreaInsets';
import { simpleDb } from '@onekeyhq/kit/src/components/WebView/mock';

import { usePromiseResult } from '../../../../hooks/usePromiseResult';
import DiscoverDashboard from '../../Dashboard';
import {
  homeTab,
  useWebTabsActions,
  withProviderWebTabs,
} from '../Context/contextWebTabs';

import BrowserInfoBar from './BrowserInfoBar';
import WebTabContainer from './WebTabContainer';

import type { DAppItemType } from '../../types';

export function useTabBarDataFromSimpleDb() {
  const result = usePromiseResult(async () => {
    const r = await simpleDb.discoverWebTabs.getRawData();
    return r?.tabs || [{ ...homeTab }];
  }, []);

  return result;
}

function HandleRebuildTabBarData() {
  const actions = useWebTabsActions();
  const result = useTabBarDataFromSimpleDb();
  useEffect(() => {
    const data = result.result;
    if (data && Array.isArray(data)) {
      actions.setWebTabs(data);
    }
  }, [actions, result.result]);

  return null;
}

function ExplorerMobileCmp() {
  const actions = useWebTabsActions();
  const { top } = useSafeAreaInsets();
  const [showHome, setShowHome] = useState(true);

  return (
    <Stack flex={1} bg="$bg" mt={`${top}px`}>
      <HandleRebuildTabBarData />
      <Freeze freeze={!showHome}>
        <DiscoverDashboard
          key="dashboard"
          onItemSelect={(dapp: DAppItemType) => {
            setShowHome(false);
            actions.openMatchDApp({ id: dapp._id, dapp });
          }}
        />
      </Freeze>
      {!showHome && (
        <>
          <BrowserInfoBar />
          <WebTabContainer />
        </>
      )}
    </Stack>
  );
}

const ExplorerMobile = withProviderWebTabs(ExplorerMobileCmp);
export default ExplorerMobile;
