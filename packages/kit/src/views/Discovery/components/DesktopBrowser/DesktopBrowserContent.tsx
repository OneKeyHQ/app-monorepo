import { useMemo } from 'react';

import { Freeze } from 'react-freeze';

import { useWebTabData } from '../../hooks/useWebTabs';
import WebContent from '../WebContent/WebContent';

function DesktopBrowserContent({
  id,
  activeTabId,
}: {
  id: string;
  activeTabId: string | null;
}) {
  const { tab } = useWebTabData(id);
  const isActive = useMemo(() => activeTabId === id, [activeTabId, id]);
  return (
    <Freeze key={id} freeze={!isActive}>
      <WebContent id={id} url={tab.url} isCurrent={isActive} />
    </Freeze>
  );
}

export default DesktopBrowserContent;
