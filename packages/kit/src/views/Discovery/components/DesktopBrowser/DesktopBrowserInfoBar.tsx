import { IconButton, Text, XStack } from '@onekeyhq/components';

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
    <XStack bg="$bg" w="100%" h="$12" px="$8" alignItems="center" space="$3">
      <Text>{url}</Text>
      <IconButton
        icon="ArrowLeftOutline"
        disabled={!canGoBack}
        onPress={goBack}
      />
      <IconButton
        icon="ArrowTopOutline"
        disabled={!canGoForward}
        onPress={goForward}
      />
      <IconButton
        icon={loading ? 'CrossedLargeOutline' : 'RenewOutline'}
        onPress={loading ? stopLoading : reload}
      />
    </XStack>
  );
}

export default DesktopBrowserInfoBar;
