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
  updateFirstRemindDAPP,
  updateHistory,
} from '@onekeyhq/kit/src/store/reducers/discover';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import Home from '../Home';

import Desktop from './Content/Desktop';
import Mobile from './Content/Mobile';
import DappOpenHintDialog from './DappOpenHintDialog';
import MoreMenuView from './MoreMenu';
import { useWebviewRef } from './useWebviewRef';

import type { DAppItemType } from '../type';

export type ExplorerViewProps = {
  displayInitialPage?: boolean;
  searchContent?: string;
  onSearchContentChange?: (text: string) => void;
  onSearchSubmitEditing?: (text: DAppItemType | string) => void;
  explorerContent: React.ReactNode;
  onGoBack?: () => void;
  onNext?: () => void;
  onRefresh?: () => void;
  onMore?: () => void;
  moreView: React.ReactNode;
  showExplorerBar?: boolean;
};

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

  const {
    canGoBack: webCanGoBack,
    goBack,
    goForward,
    url: webUrl,
  } = useWebviewRef(webviewRef, navigationStateChangeEvent);
  const [visibleMore, setVisibleMore] = useState(false);

  const [displayInitialPage, setDisplayInitialPage] = useState(true);

  const [searchContent, setSearchContent] = useState<string | undefined>();
  const [currentUrl, setCurrentUrl] = useState<string | undefined>();

  const [showExplorerBar, setShowExplorerBar] = useState<boolean>(false);

  const [showDappOpenHint, setShowDappOpenHint] = useState<boolean>(false);
  const [dappOpenPayload, setDappOpenPayload] = useState<DAppItemType>();
  const [refreshKey, setRefreshKey] = useState<string>();

  const isSmallLayout = useIsSmallLayout();

  useEffect(() => {
    if (platformEnv.isNative || platformEnv.isDesktop) {
      setShowExplorerBar(true);
    } else {
      setShowExplorerBar(false);
    }
  }, []);

  const gotoUrl = (item: (string | DAppItemType) | undefined) => {
    if (!platformEnv.isNative && !platformEnv.isDesktop) {
      if (typeof item === 'string') {
        openBrowser.openUrl(item);
      } else {
        openBrowser.openUrl(item?.url ?? '');
      }
      return;
    }

    if (!item || (typeof item === 'string' && item.trim().length === 0)) {
      setDisplayInitialPage(true);
      return;
    }

    if (typeof item === 'string') {
      setDisplayInitialPage(false);
      if (item !== currentUrl) {
        setCurrentUrl(item ?? '');
      }
    } else if (!discover.firstRemindDAPP) {
      setDappOpenPayload(item);
      setShowDappOpenHint(true);
    } else if (item) {
      setDisplayInitialPage(false);
      setCurrentUrl(item.url ?? '');
      dispatch(updateHistory(item.id));
    }
  };

  useEffect(() => {
    setSearchContent(displayInitialPage ? '' : webUrl ?? currentUrl ?? '');
  }, [currentUrl, webUrl, displayInitialPage]);

  const onSearchSubmitEditing = (dapp: DAppItemType | string) => {
    if (typeof dapp === 'string') {
      console.log('onSearchSubmitEditing', dapp);
      try {
        let url = dapp;
        if (!url.startsWith('http') && url.indexOf('.') !== -1 && url) {
          url = `http://${url}`;
        }
        url = new URL(url).toString();

        if (url) gotoUrl(url);
      } catch (error) {
        gotoUrl(`https://www.google.com/search?q=${dapp}`);
        console.log('not a url', error);
      }
    } else if (dapp) {
      gotoUrl(dapp);
    }
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
      gotoUrl(currentUrl);
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

  const onMore = () => {
    setVisibleMore(!visibleMore);
  };

  const onCopyUrlToClipboard = () => {
    copyToClipboard(currentUrl ?? '');
    toast.info(intl.formatMessage({ id: 'msg__copied' }));
  };

  const onOpenBrowser = () => {
    openBrowser.openUrlExternal(currentUrl ?? '');
  };

  const onShare = () => {
    try {
      Share.share(
        Platform.OS === 'ios'
          ? {
              url: currentUrl ?? '',
            }
          : {
              message: currentUrl ?? '',
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
    () => (
      <Box flex={1}>
        {displayInitialPage ? (
          <Home
            onItemSelect={(item) => {
              gotoUrl(item);
            }}
          />
        ) : (
          <WebView
            src={currentUrl ?? ''}
            onWebViewRef={(ref) => {
              setWebviewRef(ref);
            }}
            onNavigationStateChange={setNavigationStateChangeEvent}
            allowpopups={false}
          />
        )}
      </Box>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUrl, displayInitialPage],
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
            onGoBack={onGoBack}
            onNext={onNext}
            onRefresh={onRefresh}
            onMore={onMore}
            moreView={moreViewContent}
            showExplorerBar={showExplorerBar}
          />
        )}
      </Box>
      <DappOpenHintDialog
        payload={dappOpenPayload}
        visible={showDappOpenHint}
        onVisibleChange={setShowDappOpenHint}
        onAgree={(payload) => {
          setDisplayInitialPage(false);
          if (payload?.url !== currentUrl) {
            setCurrentUrl(payload?.url ?? '');
          }
          if (payload) {
            dispatch(updateFirstRemindDAPP(true));
            dispatch(updateHistory(payload.id));
          }
        }}
      />
    </>
  );
};

export default Explorer;
