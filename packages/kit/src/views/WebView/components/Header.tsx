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

// Push the close button and the MoreMenu trigger flush to the header edges.
// react-navigation defaults to ~$4 padding on each side which leaves a
// noticeable gap; the WebView header is dense and benefits from edge-aligned
// buttons.
const FLUSH_LEFT_CONTAINER_STYLE = { paddingLeft: 0, paddingHorizontal: 0 };
const FLUSH_RIGHT_CONTAINER_STYLE = { paddingRight: 0, paddingHorizontal: 0 };

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

  // `headerLeftContainerStyle` / `headerRightContainerStyle` are valid runtime
  // props for HeaderView (see HeaderView.tsx:108) but aren't exposed on
  // IPageHeaderProps' typed surface — Page.Header narrows to a subset of
  // IStackNavigationOptions. Pass via spread + cast to avoid widening the
  // shared type.
  const extraContainerStyles = {
    headerLeftContainerStyle: FLUSH_LEFT_CONTAINER_STYLE,
    headerRightContainerStyle: FLUSH_RIGHT_CONTAINER_STYLE,
  } as Record<string, unknown>;
  return (
    <Page.Header
      title={resolvedTitle}
      headerRight={renderHeaderRight}
      {...extraContainerStyles}
    />
  );
}

export default WebViewHeader;
