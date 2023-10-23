import { memo, useEffect } from 'react';

import { Stack, useThemeValue } from '@onekeyhq/components';
import useSafeAreaInsets from '@onekeyhq/components/src/Provider/hooks/useSafeAreaInsets';
import { simpleDb } from '@onekeyhq/kit/src/components/WebView/mock';

import { usePromiseResult } from '../../../../hooks/usePromiseResult';
import { webHandler } from '../../explorerUtils';
import WebHomeContainer from '../Content/WebHomeContainer';
import {
  homeTab,
  setWebTabsWriteAtom,
  useAtomWebTabs,
  withProviderWebTabs,
} from '../Context/contextWebTabs';

import ControllerBarDesktop from './ControllerBarDesktop';
import TabBarDesktop from './TabBarDesktop';
import TabbedWebContainer from './TabbedWebContainer';

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
      <ControllerBarDesktop />
    </Stack>
  );
}

const ExplorerHeader = memo(ExplorerHeaderCmp);

function ExplorerDesktopCmp() {
  return (
    <Stack flex={1} zIndex={3}>
      {showExplorerBar && <ExplorerHeader />}
      {webHandler === 'tabbedWebview' ? (
        <TabbedWebContainer />
      ) : (
        <WebHomeContainer />
      )}
    </Stack>
  );
}

const ExplorerDesktop = withProviderWebTabs(ExplorerDesktopCmp);

export default ExplorerDesktop;
