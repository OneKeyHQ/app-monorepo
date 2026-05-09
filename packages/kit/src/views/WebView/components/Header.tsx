import { useMemo } from 'react';

import {
  IconButton,
  Page,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import MoreMenu from './MoreMenu';

export interface IWebViewHeaderProps {
  url: string | undefined;
  title: string | undefined;
  fallbackTitle?: string | undefined;
  hidden?: boolean;
  onReload: () => void;
  // Always close via the root navigation (rootNavigationRef.goBack), not the
  // closest navigator — on desktop this header lives inside the TabNavigator
  // slot via Portal and `useNavigation()` would resolve to the host tab.
  onClose: () => void;
}

function deriveHostFallback(url: string | undefined): string {
  if (!url) return '';
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}

/**
 * Header for the WebView overlay.
 *
 * Native uses `Page.Header` so the platform-native back/close affordance is
 * inherited from the parent Stack.Navigator. Desktop renders the WebView as
 * portal content with no inner Stack.Navigator, so `Page.Header` can't wire
 * itself up — we render a custom XStack header there.
 */
function WebViewHeader({
  url,
  title,
  fallbackTitle,
  hidden,
  onReload,
  onClose,
}: IWebViewHeaderProps) {
  const resolvedTitle = useMemo(() => {
    if (fallbackTitle && fallbackTitle.length > 0) return fallbackTitle;
    if (title && title.length > 0) return title;
    return deriveHostFallback(url);
  }, [fallbackTitle, title, url]);

  const moreMenuNode = useMemo(
    () => <MoreMenu url={url} title={resolvedTitle} onReload={onReload} />,
    [onReload, resolvedTitle, url],
  );

  if (hidden) {
    if (platformEnv.isDesktop) {
      return null;
    }
    return <Page.Header headerShown={false} />;
  }

  if (platformEnv.isDesktop) {
    return (
      <XStack
        alignItems="center"
        justifyContent="space-between"
        gap="$2"
        px="$3"
        py="$2"
        borderBottomWidth={1}
        borderBottomColor="$borderSubdued"
        bg="$bg"
      >
        <IconButton
          icon="CrossedLargeOutline"
          variant="tertiary"
          onPress={onClose}
        />
        <Stack flex={1} alignItems="center">
          <SizableText
            size="$bodyMdMedium"
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {resolvedTitle}
          </SizableText>
        </Stack>
        {moreMenuNode}
      </XStack>
    );
  }

  const renderHeaderRight = () => moreMenuNode;
  return <Page.Header title={resolvedTitle} headerRight={renderHeaderRight} />;
}

export default WebViewHeader;
