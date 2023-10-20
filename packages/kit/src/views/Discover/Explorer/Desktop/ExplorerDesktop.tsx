import { useEffect } from 'react';

import { Stack, useThemeValue } from '@onekeyhq/components';
import useSafeAreaInsets from '@onekeyhq/components/src/Provider/hooks/useSafeAreaInsets';
import { simpleDb } from '@onekeyhq/kit/src/components/WebView/mock';

import { usePromiseResult } from '../../../../hooks/usePromiseResult';
import {
  homeTab,
  setWebTabsWriteAtom,
  useAtomWebTabs,
  withProviderWebTabs,
} from '../Context/contextWebTabs';
import { webHandler } from '../explorerUtils';

// import ControllerBarDesktop from './ControllerBarDesktop';
import TabBarDesktop from './TabBarDesktop';

const showExplorerBar = webHandler !== 'browser';

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
    console.log('===>result: ', data);
    if (data && Array.isArray(data)) {
      setWebTabsData(data);
    }
  }, [result.result, setWebTabsData]);

  return null;
}

function ExplorerHeaderCmp() {
  const { top } = useSafeAreaInsets();
  const tabBarBgColor = useThemeValue('bgSubdued') as string;
  return (
    <Stack mt={`${top ? top + 10 : 0}px`} bg={tabBarBgColor} zIndex={5}>
      <HandleRebuildTabBarData />
      <TabBarDesktop />
      {/* <ControllerBarDesktop /> */}
    </Stack>
  );
}

const ExplorerHeader = withProviderWebTabs(ExplorerHeaderCmp);

function ExplorerDesktop() {
  return (
    <Stack flex={1} zIndex={3}>
      {!showExplorerBar && <ExplorerHeader />}
      <Stack>WebView Content</Stack>
    </Stack>
  );
}

export default ExplorerDesktop;
