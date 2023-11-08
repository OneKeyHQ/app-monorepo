import { memo, useEffect, useMemo } from 'react';

import { Stack } from 'tamagui';

import MobileBrowserContent from '../../components/MobileBrowser/MobileBrowserContent';
import MobileBrowserInfoBar from '../../components/MobileBrowser/MobileBrowserInfoBar';
import { useTabDataFromSimpleDb } from '../../hooks/useTabDataFromSimpleDb';
import useWebTabAction from '../../hooks/useWebTabAction';
import { useActiveTabId, useWebTabs } from '../../hooks/useWebTabs';
import { withProviderWebTabs } from '../Context/contextWebTabs';

function HandleRebuildTabBarData() {
  const result = useTabDataFromSimpleDb();
  const { setWebTabs, addBlankWebTab } = useWebTabAction();

  useEffect(() => {
    if (!result.result) return;
    const data = result.result;
    if (data && Array.isArray(data) && data.length > 0) {
      setWebTabs(data);
    } else {
      addBlankWebTab();
    }
  }, [result.result, addBlankWebTab, setWebTabs]);

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
