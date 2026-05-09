import { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';
import { Share } from 'react-native';

import type { IActionListItemProps } from '@onekeyhq/components';
import { ActionList, Toast, useClipboard } from '@onekeyhq/components';
import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import { useBrowserBookmarkAction } from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import { DiscoveryBrowserProviderMirror } from '@onekeyhq/kit/src/views/Discovery/components/DiscoveryBrowserProviderMirror';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

export interface IMoreMenuProps {
  url: string | undefined;
  title: string | undefined;
  onReload: () => void;
}

function MoreMenu({ url, title, onReload }: IMoreMenuProps) {
  const intl = useIntl();
  const { copyText } = useClipboard();
  const { addOrUpdateBrowserBookmark, getBookmarkData } =
    useBrowserBookmarkAction().current;

  const handleCopyUrl = useCallback(() => {
    if (url) copyText(url);
  }, [copyText, url]);

  const handleOpenExternal = useCallback(() => {
    if (url) openUrlExternal(url);
  }, [url]);

  const handleAddBookmark = useCallback(async () => {
    if (!url) return;
    // Pre-check existing bookmarks so we don't show a misleading
    // "added" toast on duplicate taps. addOrUpdateBrowserBookmark
    // silently overwrites, so without this check we'd appear to add
    // the same URL repeatedly.
    const bookmarks = await getBookmarkData();
    const alreadyBookmarked = bookmarks.some((item) => item.url === url);
    if (alreadyBookmarked) {
      return;
    }
    await addOrUpdateBrowserBookmark({
      url,
      title: title ?? '',
      logo: undefined,
      sortIndex: undefined,
    });
    Toast.success({
      title: intl.formatMessage({
        id: ETranslations.explore_toast_bookmark_added,
      }),
    });
  }, [addOrUpdateBrowserBookmark, getBookmarkData, intl, title, url]);

  const handleShare = useCallback(() => {
    if (!url) return;
    // Defer to escape the popover dismissal frame on native.
    setTimeout(() => {
      void Share.share(
        platformEnv.isNativeIOS ? { url } : { message: url },
      ).catch(() => {
        // user cancelled or platform refused — ignore
      });
    }, 300);
  }, [url]);

  const items = useMemo<IActionListItemProps[]>(() => {
    const list: (IActionListItemProps | undefined)[] = [
      {
        label: intl.formatMessage({ id: ETranslations.global_refresh }),
        icon: 'RefreshCwOutline',
        onPress: onReload,
      },
      {
        label: intl.formatMessage({ id: ETranslations.global_copy_url }),
        icon: 'LinkOutline',
        onPress: handleCopyUrl,
      },
      {
        label: intl.formatMessage({
          id: ETranslations.explore_open_in_browser,
        }),
        icon: 'GlobusOutline',
        onPress: handleOpenExternal,
      },
      {
        label: intl.formatMessage({ id: ETranslations.explore_add_bookmark }),
        icon: 'BookmarkOutline',
        onPress: handleAddBookmark,
      },
      platformEnv.isNative
        ? {
            label: intl.formatMessage({ id: ETranslations.explore_share }),
            icon: 'ShareOutline',
            onPress: handleShare,
          }
        : undefined,
    ];
    return list.filter(Boolean);
  }, [
    handleAddBookmark,
    handleCopyUrl,
    handleOpenExternal,
    handleShare,
    intl,
    onReload,
  ]);

  return (
    <ActionList
      renderTrigger={<HeaderIconButton icon="DotHorOutline" />}
      title={intl.formatMessage({ id: ETranslations.explore_options })}
      sections={[{ items }]}
      disabled={!url}
    />
  );
}

// React Native screens portals header content out of the page subtree, so
// the parent <DiscoveryBrowserProviderMirror> wrapping WebViewPage doesn't
// reach MoreMenu when it's rendered as `headerRight`. Re-attach the mirror
// here — `getOrCreateStore` returns the same store, so this only adds a
// provider, not a duplicate state.
const MemoizedMoreMenu = memo(MoreMenu);

function MoreMenuWithContext(props: IMoreMenuProps) {
  return (
    <DiscoveryBrowserProviderMirror>
      <MemoizedMoreMenu {...props} />
    </DiscoveryBrowserProviderMirror>
  );
}

export default MoreMenuWithContext;
