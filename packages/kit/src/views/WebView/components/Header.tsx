import { useCallback, useMemo } from 'react';

import { Page } from '@onekeyhq/components';

import MoreMenu from './MoreMenu';

export interface IWebViewHeaderProps {
  url: string | undefined;
  title: string | undefined;
  fallbackTitle?: string | undefined;
  hidden?: boolean;
  onReload: () => void;
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
 * Page header for the WebView overlay route.
 *
 * Title priority: explicit `fallbackTitle` (from route params) > live page
 * title > host name fallback. Uses the navigator-provided header so the
 * close button comes from the platform back/close affordance, with a
 * MoreMenu trigger on the right.
 */
function WebViewHeader({
  url,
  title,
  fallbackTitle,
  hidden,
  onReload,
}: IWebViewHeaderProps) {
  const resolvedTitle = useMemo(() => {
    if (fallbackTitle && fallbackTitle.length > 0) return fallbackTitle;
    if (title && title.length > 0) return title;
    return deriveHostFallback(url);
  }, [fallbackTitle, title, url]);

  const renderHeaderRight = useCallback(
    () => <MoreMenu url={url} title={resolvedTitle} onReload={onReload} />,
    [onReload, resolvedTitle, url],
  );

  if (hidden) {
    return <Page.Header headerShown={false} />;
  }

  return <Page.Header title={resolvedTitle} headerRight={renderHeaderRight} />;
}

export default WebViewHeader;
