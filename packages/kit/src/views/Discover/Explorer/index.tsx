import React, { FC, useEffect, useMemo, useState } from 'react';

import { IWebViewWrapperRef } from '@onekeyfe/onekey-cross-webview';
import { useIntl } from 'react-intl';
import { Platform, Share } from 'react-native';

import { Box, useIsSmallLayout } from '@onekeyhq/components';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import WebView from '@onekeyhq/kit/src/components/WebView';
import { useToast } from '@onekeyhq/kit/src/hooks';
import { useAppSelector } from '@onekeyhq/kit/src/hooks/redux';
import useOpenBrowser from '@onekeyhq/kit/src/hooks/useOpenBrowser';
import {
  addWebSiteHistory,
  updateFirstRemindDAPP,
  updateHistory,
  updateWebSiteHistory,
} from '@onekeyhq/kit/src/store/reducers/discover';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import Home from '../Home';

import Desktop from './Content/Desktop';
import Mobile from './Content/Mobile';
import DappOpenHintDialog from './DappOpenHintDialog';
import MoreMenuView from './MoreMenu';
import { useWebviewRef } from './useWebviewRef';

import type { MatchDAppItemType } from './Search/useSearchHistories';

type WebSiteType = {
  url?: string;
  title?: string;
  favicon?: string;
  historyId?: string;
};

export type ExplorerViewProps = {
  displayInitialPage?: boolean;
  searchContent?: string;
  loading?: boolean;
  onSearchContentChange?: (text: string) => void;
  onSearchSubmitEditing?: (text: MatchDAppItemType | string) => void;
  explorerContent: React.ReactNode;
  canGoBack?: boolean;
  canGoForward?: boolean;
  onGoBack?: () => void;
  onNext?: () => void;
  onRefresh?: () => void;
  onStopLoading?: () => void;
  onMore?: () => void;
  moreView: React.ReactNode;
  showExplorerBar?: boolean;
};

let dappOpenConfirm: ((confirm: boolean) => void) | undefined;

// 空白页面 URL
const BrowserPage = 'about:blank';

const Explorer: FC = () => {
  const intl = useIntl();
  const toast = useToast();
  const openBrowser = useOpenBrowser();

  const { dispatch } = backgroundApiProxy;
  const discover = useAppSelector((s) => s.discover);

  const [navigationStateChangeEvent, setNavigationStateChangeEvent] = useState<
    any | null
  >(null);
  const [webviewRef, setWebviewRef] = useState<IWebViewWrapperRef | null>(null);

  const [canGoBack, setCanGoBack] = useState<boolean>(false);
  const [canGoForward, setCanGoForward] = useState<boolean>(false);

  const {
    canGoBack: webCanGoBack,
    canGoForward: webCanGoForward,
    goBack,
    goForward,
    stopLoading,
    loading: webLoading,
    url: webUrl,
    title: webTitle,
    favicon: webFavicon,
  } = useWebviewRef(webviewRef, navigationStateChangeEvent);
  const [visibleMore, setVisibleMore] = useState(false);

  const [displayInitialPage, setDisplayInitialPage] = useState(true);
  const [searchContent, setSearchContent] = useState<string>();
  const [currentWebSite, setCurrentWebSite] = useState<WebSiteType>();

  const [showExplorerBar, setShowExplorerBar] = useState<boolean>(false);

  const [showDappOpenHint, setShowDappOpenHint] = useState<boolean>(false);

  const [refreshKey, setRefreshKey] = useState<string>();

  const isSmallLayout = useIsSmallLayout();

  useEffect(() => {
    if (platformEnv.isNative || platformEnv.isDesktop) {
      setShowExplorerBar(true);
    } else {
      setShowExplorerBar(false);
    }
  }, []);

  const gotoUrl = async (item: (string | MatchDAppItemType) | undefined) => {
    if (!platformEnv.isNative && !platformEnv.isDesktop) {
      if (typeof item === 'string') {
        openBrowser.openUrl(item);
      } else if (item?.dapp) {
        openBrowser.openUrl(item?.dapp?.url ?? '');
      } else if (item?.webSite) {
        openBrowser.openUrl(item?.webSite?.url ?? '');
      }
      return false;
    }

    if (!item || (typeof item === 'string' && item.trim().length === 0)) {
      setDisplayInitialPage(true);
      return false;
    }

    // 打开的是一个链接
    if (typeof item === 'string') {
      setDisplayInitialPage(false);

      try {
        let url = item;
        if (!url.startsWith('http') && url.indexOf('.') !== -1 && url) {
          url = `http://${url}`;
        }
        url = new URL(url).toString();

        if (url) {
          setCurrentWebSite({ url });

          dispatch(
            addWebSiteHistory({
              keyUrl: undefined,
              webSite: { url },
            }),
          );
        }
      } catch (error) {
        setCurrentWebSite({ url: BrowserPage });
        setSearchContent(item);
        console.log('not a url', error);
      }

      return true;
    }

    // 打开的是一个手动输入的历史记录
    if (item?.webSite) {
      setDisplayInitialPage(false);
      if (item?.webSite?.url !== currentWebSite?.url) {
        setCurrentWebSite({
          url: item?.webSite?.url,
          title: item?.webSite?.title,
          favicon: item?.webSite?.favicon,
          historyId: item?.id,
        });
      }
      dispatch(
        addWebSiteHistory({
          keyUrl: item.id,
          webSite: {},
        }),
      );
      return true;
    }

    // 打开的是 Dapp, 处理首次打开 Dapp 提示
    if (item?.dapp && discover.firstRemindDAPP) {
      setShowDappOpenHint(true);

      const isConfirm = await new Promise<boolean>((resolve) => {
        dappOpenConfirm = resolve;
      });

      if (isConfirm) {
        setDisplayInitialPage(false);
        if (item?.dapp?.url !== currentWebSite?.url) {
          setCurrentWebSite({
            url: item?.dapp?.url,
            title: item?.dapp?.name,
            favicon: item?.dapp?.favicon,
            historyId: item?.id,
          });
        }
        if (item) {
          dispatch(updateFirstRemindDAPP(false));
          dispatch(updateHistory(item.id));
        }
        return true;
      }
      return false;
    }

    // 正常跳转 Dapp
    if (item?.dapp) {
      setDisplayInitialPage(false);
      setCurrentWebSite({
        url: item?.dapp?.url,
        title: item?.dapp?.name,
        favicon: item?.dapp?.favicon,
        historyId: item?.id,
      });
      dispatch(updateHistory(item.id));
      return true;
    }
    return false;
  };

  useEffect(() => {
    let content: string;
    if (displayInitialPage) {
      content = '';
    } else if (webUrl && webUrl.trim() !== '') {
      content = webUrl;
    } else {
      content = currentWebSite?.url ?? '';
    }

    if (content !== BrowserPage) setSearchContent(content);

    if (displayInitialPage === false || webCanGoBack()) {
      setCanGoBack(true);
    } else {
      setCanGoBack(false);
    }

    if (displayInitialPage === true) {
      if (webCanGoForward() || currentWebSite) {
        setCanGoForward(true);
      } else {
        setCanGoForward(false);
      }
    } else {
      setCanGoForward(false);
    }
  }, [
    currentWebSite,
    webUrl,
    displayInitialPage,
    webCanGoBack,
    webCanGoForward,
  ]);

  useEffect(() => {
    dispatch(
      updateWebSiteHistory({
        keyUrl: currentWebSite?.historyId,
        webSite: { url: webUrl, title: webTitle, favicon: webFavicon },
      }),
    );
    // currentWebSite 变动不更新 history
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, webTitle, webUrl, webFavicon]);

  const onSearchSubmitEditing = (dapp: MatchDAppItemType | string) => {
    if (typeof dapp === 'string') {
      console.log('onSearchSubmitEditing', dapp);
    }
    gotoUrl(dapp);
  };

  const onGoBack = () => {
    console.log('onGoBack', webCanGoBack());

    if (webCanGoBack()) {
      goBack();
    } else {
      gotoUrl(undefined);
    }

    console.log('onGoBack');
  };

  const onNext = () => {
    if (displayInitialPage === true) {
      setDisplayInitialPage(false);
    } else {
      goForward();
    }
    console.log('onNext');
  };

  const onRefresh = () => {
    try {
      setRefreshKey(Math.random().toString());
    } catch (error) {
      console.warn(error);
    }
    console.log('onRefresh');
  };

  const onStopLoading = () => {
    stopLoading();
  };

  const onMore = () => {
    setVisibleMore(!visibleMore);
  };

  const onGoHomePage = () => {
    setDisplayInitialPage(true);
  };

  const getCurrentUrl = () => webUrl ?? currentWebSite?.url ?? '';

  const onCopyUrlToClipboard = () => {
    copyToClipboard(getCurrentUrl());
    toast.show({ title: intl.formatMessage({ id: 'msg__copied' }) });
  };

  const onOpenBrowser = () => {
    openBrowser.openUrlExternal(getCurrentUrl());
  };

  const onShare = () => {
    try {
      Share.share(
        Platform.OS === 'ios'
          ? {
              url: getCurrentUrl(),
            }
          : {
              message: getCurrentUrl(),
            },
      )
        .then((result) => {
          console.log(result);
        })
        .catch((error) => {
          console.error(error);
        });
    } catch (error) {
      console.warn(error);
    }
  };

  const explorerContent = useMemo(
    () => {
      console.log('explorerContent render');

      return (
        <Box flex={1}>
          {displayInitialPage ? (
            <Home
              onItemSelect={(item) => gotoUrl({ id: item.id, dapp: item })}
            />
          ) : (
            <WebView
              src={currentWebSite?.url ?? ''}
              onWebViewRef={(ref) => {
                setWebviewRef(ref);
              }}
              onNavigationStateChange={setNavigationStateChangeEvent}
              allowpopups={false}
            />
          )}
        </Box>
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentWebSite, displayInitialPage],
  );

  const moreViewContent = useMemo(
    () => (
      <MoreMenuView
        visible={visibleMore}
        onVisibleChange={setVisibleMore}
        onRefresh={onRefresh}
        onShare={onShare}
        onOpenBrowser={onOpenBrowser}
        onCopyUrlToClipboard={onCopyUrlToClipboard}
        onGoHomePage={onGoHomePage}
      />
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibleMore],
  );

  return (
    <>
      <Box flex={1} bg="background-default">
        {isSmallLayout ? (
          <Mobile
            key={refreshKey}
            searchContent={searchContent}
            onSearchContentChange={setSearchContent}
            onSearchSubmitEditing={onSearchSubmitEditing}
            explorerContent={explorerContent}
            canGoBack={canGoBack}
            onGoBack={onGoBack}
            onNext={onNext}
            onRefresh={onRefresh}
            onMore={onMore}
            moreView={moreViewContent}
            showExplorerBar={showExplorerBar}
          />
        ) : (
          <Desktop
            key={refreshKey}
            displayInitialPage={displayInitialPage}
            searchContent={searchContent}
            onSearchContentChange={setSearchContent}
            onSearchSubmitEditing={onSearchSubmitEditing}
            explorerContent={explorerContent}
            canGoBack={canGoBack}
            canGoForward={canGoForward}
            loading={webLoading}
            onGoBack={onGoBack}
            onNext={onNext}
            onRefresh={onRefresh}
            onStopLoading={onStopLoading}
            onMore={onMore}
            moreView={moreViewContent}
            showExplorerBar={showExplorerBar}
          />
        )}
      </Box>
      <DappOpenHintDialog
        visible={showDappOpenHint}
        onVisibilityChange={() => {
          setShowDappOpenHint(false);
          dappOpenConfirm = undefined;
        }}
        onConfirm={() => {
          setShowDappOpenHint(false);
          dappOpenConfirm?.(true);
        }}
      />
    </>
  );
};

export default Explorer;
