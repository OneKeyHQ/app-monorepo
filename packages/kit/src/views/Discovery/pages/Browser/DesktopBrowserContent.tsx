import { Freeze } from 'react-freeze';

import { useBrowserHistoryAction } from '@onekeyhq/kit/src/states/jotai/contexts/discovery';

import WebContent from '../../components/WebContent/WebContent';
import { useWebTabDataById } from '../../hooks/useWebTabs';

function DesktopBrowserContent({
  id,
  activeTabId,
}: {
  id: string;
  activeTabId: string | null;
}) {
  const { tab } = useWebTabDataById(id);
  const isActive = activeTabId === id;
  const { addBrowserHistory } = useBrowserHistoryAction().current;
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
