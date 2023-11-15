import { memo, useEffect } from 'react';

import { Stack, useThemeValue } from '@onekeyhq/components';
import useSafeAreaInsets from '@onekeyhq/components/src/Provider/hooks/useSafeAreaInsets';
import { simpleDb } from '@onekeyhq/kit/src/components/WebView/mock';

import { usePromiseResult } from '../../../../hooks/usePromiseResult';
import { webHandler } from '../../explorerUtils';
import WebHomeContainer from '../Content/WebHomeContainer';
import {
  homeTab,
  useWebTabsActions,
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

function ExplorerHeaderCmp() {
  const { top } = useSafeAreaInsets();
  const tabBarBgColor = useThemeValue('bgSubdued');
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
