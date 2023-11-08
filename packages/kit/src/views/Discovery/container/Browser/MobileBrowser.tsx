import { memo, useEffect, useMemo } from 'react';

import { Stack } from 'tamagui';

import MobileBrowserContent from '../../components/MobileBrowser/MobileBrowserContent';
import MobileBrowserInfoBar from '../../components/MobileBrowser/MobileBrowserInfoBar';
import { useTabDataFromSimpleDb } from '../../hooks/useTabDataFromSimpleDb';
import { useActiveTabId, useWebTabs } from '../../hooks/useWebTabs';
import {
  addBlankWebTabAtom,
  setCurrentWebTabAtom,
  setWebTabsAtom,
  useAtomWebTabs,
  withProviderWebTabs,
} from '../Context/contextWebTabs';

function HandleRebuildTabBarData() {
  const result = useTabDataFromSimpleDb();
  const [, setWebTabsData] = useAtomWebTabs(setWebTabsAtom);
  const [, setCurrentWebTab] = useAtomWebTabs(setCurrentWebTabAtom);
  const [, addBlankWebTab] = useAtomWebTabs(addBlankWebTabAtom);

  useEffect(() => {
    if (!result.result) return;
    const data = result.result;
    if (data && Array.isArray(data) && data.length > 0) {
      setWebTabsData(data);
    } else {
      addBlankWebTab();
    }
  }, [result.result, setWebTabsData, setCurrentWebTab, addBlankWebTab]);

  return null;
}

function MobileBrowser() {
  const { tabs } = useWebTabs();
  const { activeTabId } = useActiveTabId();

  useEffect(() => {
    console.log('MobileBrowser renderer ===> : ');
  }, []);

  const content = useMemo(
    () => tabs.map((t) => <MobileBrowserContent id={t.id} key={t.id} />),
    [tabs],
  );

  return (
    <Stack flex={1} zIndex={3}>
      <HandleRebuildTabBarData />
      <MobileBrowserInfoBar id={activeTabId ?? ''} />
      {content}
    </Stack>
  );
}

export default memo(withProviderWebTabs(MobileBrowser));
