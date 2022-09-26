import { FC, useEffect, useMemo, useState } from 'react';

import { RouteProp, useRoute } from '@react-navigation/core';
import { Freeze } from 'react-freeze';
import { useIntl } from 'react-intl';
import { Platform, Share } from 'react-native';

import {
  Box,
  DialogManager,
  useIsVerticalLayout,
  useToast,
} from '@onekeyhq/components';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useAppSelector } from '@onekeyhq/kit/src/hooks/redux';
import {
  addWebSiteHistory,
  updateFirstRemindDAPP,
  updateHistory,
  updateWebSiteHistory,
} from '@onekeyhq/kit/src/store/reducers/discover';
import { openUrl, openUrlExternal } from '@onekeyhq/kit/src/utils/openUrl';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { TabRoutes, TabRoutesParams } from '../../../routes/types';

import Desktop from './Container/Desktop';
import Mobile from './Container/Mobile';
import WebContent from './Content/WebContent';
import DappOpenHintDialog from './DappOpenHintDialog';
import {
  MatchDAppItemType,
  SearchContentType,
  webHandler,
} from './explorerUtils';

export type ExplorerViewProps = {
  searchContent?: SearchContentType;
  loading?: boolean;
  onSearchContentChange?: (text: SearchContentType) => void;
  onSearchSubmitEditing?: (text: MatchDAppItemType | string) => void;
  explorerContent: React.ReactNode;
  canGoBack?: boolean;
  canGoForward?: boolean;
  onGoBack?: () => void;
  onNext?: () => void;
  onRefresh?: () => void;
  onStopLoading?: () => void;
  showExplorerBar?: boolean;
};

let dappOpenConfirm: ((confirm: boolean) => void) | undefined;

const blankPage = 'about:blank';

const showExplorerBar = webHandler !== 'browser';

type DiscoverRouteProp = RouteProp<TabRoutesParams, TabRoutes.Discover>;
const Explorer: FC = () => {
  const intl = useIntl();
  const toast = useToast();
  const route = useRoute<DiscoverRouteProp>();
  const { incomingUrl } = route.params || {};
  const { dispatch } = backgroundApiProxy;
  const discover = useAppSelector((s) => s.discover);
  const { tabs } = useAppSelector((s) => s.webTabs);

  const isVerticalLayout = useIsVerticalLayout();

  const [visibleMore, setVisibleMore] = useState(false);

  const gotoUrl = async (item: (string | MatchDAppItemType) | undefined) => {
    if (webHandler !== 'tabbedWebview') {
      if (typeof item === 'string') {
        openUrl(item);
      } else {
        openUrl(
          item?.dapp?.url || item?.webSite?.url || '',
          item?.dapp?.name || item?.webSite?.title,
        );
      }
      return false;
    }
    if (webHandler === 'webview') {
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
              webSite: { url },
            }),
          );
        }
      } catch (error) {
        setCurrentWebSite({ url: blankPage });
        setSearchContent({ searchContent: item });
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
      DialogManager.show({
        render: (
          <DappOpenHintDialog
            onVisibilityChange={() => {
              dappOpenConfirm = undefined;
            }}
            onConfirm={() => {
              dappOpenConfirm?.(true);
            }}
          />
        ),
      });

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
          dispatch(updateFirstRemindDAPP(false), updateHistory(item.id));
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
    if (incomingUrl) {
      gotoUrl(incomingUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingUrl]);

  // useEffect(() => {
  //   let content: string;
  //   if (displayInitialPage) {
  //     content = '';
  //   } else if (webUrl && webUrl.trim() !== '') {
  //     content = webUrl;
  //   } else {
  //     content = currentWebSite?.url ?? '';
  //   }

  //   if (content !== blankPage) setSearchContent({ searchContent: content });

  //   if (displayInitialPage === false || webCanGoBack()) {
  //     setCanGoBack(true);
  //   } else {
  //     setCanGoBack(false);
  //   }

  //   if (displayInitialPage === true) {
  //     if (webCanGoForward() || currentWebSite) {
  //       setCanGoForward(true);
  //     } else {
  //       setCanGoForward(false);
  //     }
  //   } else {
  //     setCanGoForward(false);
  //   }
  // }, [
  //   currentWebSite,
  //   webUrl,
  //   displayInitialPage,
  //   webCanGoBack,
  //   webCanGoForward,
  // ]);

  // useEffect(() => {
  //   dispatch(
  //     updateWebSiteHistory({
  //       keyUrl: currentWebSite?.historyId,
  //       webSite: { url: webUrl, title: webTitle, favicon: webFavicon },
  //     }),
  //   );
  //   // currentWebSite 变动不更新 history
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [dispatch, webTitle, webUrl, webFavicon]);

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
    openUrlExternal(getCurrentUrl());
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
    () =>
      tabs.map((tab) => (
        <Freeze key={tab.id} freeze={!tab.isCurrent}>
          <WebContent {...tab} />
        </Freeze>
      )),
    [tabs],
  );

  // const moreViewContent = useMemo(
  //   () => (
  //     <MoreMenuView
  //       visible={visibleMore}
  //       onVisibleChange={setVisibleMore}
  //       onRefresh={onRefresh}
  //       onShare={onShare}
  //       onOpenBrowser={onOpenBrowser}
  //       onCopyUrlToClipboard={onCopyUrlToClipboard}
  //       onGoHomePage={onGoHomePage}
  //     />
  //   ),
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  //   [visibleMore],
  // );

  return (
    <Box flex={1} bg="background-default">
      {isVerticalLayout ? (
        <Mobile
          explorerContent={explorerContent}
          showExplorerBar={showExplorerBar}
        />
      ) : (
        <Desktop
          explorerContent={explorerContent}
          showExplorerBar={showExplorerBar}
        />
      )}
    </Box>
  );
};

export default Explorer;
