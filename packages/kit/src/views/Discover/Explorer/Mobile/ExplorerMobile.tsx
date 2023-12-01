import { useEffect, useState } from 'react';

import { Freeze } from 'react-freeze';

import { Stack, useSafeAreaInsets } from '@onekeyhq/components';
import { simpleDb } from '@onekeyhq/kit/src/components/WebView/mock';

import { usePromiseResult } from '../../../../hooks/usePromiseResult';
import { onItemSelect } from '../../Controller/gotoSite';
import DiscoverDashboard from '../../Dashboard';
import {
  homeTab,
  setWebTabsWriteAtom,
  useAtomWebTabs,
  withProviderWebTabs,
} from '../Context/contextWebTabs';

import BrowserInfoBar from './BrowserInfoBar';
import WebTabContainer from './WebTabContainer';

export function useTabBarDataFromSimpleDb() {
  const result = usePromiseResult(async () => {
    const r = await simpleDb.discoverWebTabs.getRawData();
    return r?.tabs || [{ ...homeTab }];
  }, []);

  return result;
}

function HandleRebuildTabBarData() {
  const result = useTabBarDataFromSimpleDb();
  const [, setWebTabsData] = useAtomWebTabs(setWebTabsWriteAtom);
  useEffect(() => {
    const data = result.result;
    if (data && Array.isArray(data)) {
      setWebTabsData(data);
    }
  }, [result.result, setWebTabsData]);

  return null;
}

function ExplorerMobileCmp() {
  const { top } = useSafeAreaInsets();
  const [showHome, setShowHome] = useState(true);

  return (
    <Stack flex={1} bg="$bg" mt={`${top}px`}>
      <HandleRebuildTabBarData />
      <Freeze freeze={!showHome}>
        <DiscoverDashboard
          key="dashboard"
          onItemSelect={(item) => {
            setShowHome(false);
            onItemSelect(item);
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
