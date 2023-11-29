import { useMemo } from 'react';

import { Freeze } from 'react-freeze';

import { useBrowserHistoryAction } from '@onekeyhq/kit/src/states/jotai/contexts/discovery'
import { useWebTabDataById } from '../../hooks/useWebTabs';

import WebContent from '../../components/WebContent/WebContent';

function DesktopBrowserContent({
  id,
  activeTabId,
}: {
  id: string;
  activeTabId: string | null;
}) {
  const { tab } = useWebTabDataById(id);
  const isActive = useMemo(() => activeTabId === id, [activeTabId, id]);
  const { addBrowserHistory } = useBrowserHistoryAction();
  return (
    <Freeze key={id} freeze={!isActive}>
      <WebContent
        id={id}
        url={tab.url}
        isCurrent={isActive}
        addBrowserHistory={(siteInfo) => addBrowserHistory(siteInfo)}
      />
    </Freeze>
  );
}

export default DesktopBrowserContent;
