import { XStack } from '@onekeyhq/components';

import HeaderLeftToolBar from '../HeaderLeftToolBar';

import type { IWebTab } from '../../types';

function DesktopBrowserInfoBar({
  url,
  canGoBack,
  canGoForward,
  loading,
  goBack,
  goForward,
  stopLoading,
  reload,
}: IWebTab & {
  goBack: () => void;
  goForward: () => void;
  stopLoading: () => void;
  reload: () => void;
}) {
  return (
    <XStack bg="$bg" w="100%" h={52} px="$5">
      <HeaderLeftToolBar
        url={url}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        loading={loading}
        goBack={goBack}
        goForward={goForward}
        stopLoading={stopLoading}
        reload={reload}
      />
    </XStack>
  );
}

export default DesktopBrowserInfoBar;
