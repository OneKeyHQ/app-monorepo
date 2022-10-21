import { FC, useCallback, useMemo, useState } from 'react';

import { useFocusEffect } from '@react-navigation/native';
import { Freeze } from 'react-freeze';
import { useIntl } from 'react-intl';
import { Platform, Share } from 'react-native';

import { Box, useIsVerticalLayout, useToast } from '@onekeyhq/components';
import { useDesktopTopDragBarController } from '@onekeyhq/components/src/DesktopDragZoneBox/useDesktopTopDragBarController';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import { openUrlExternal } from '@onekeyhq/kit/src/utils/openUrl';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { homeTab, setWebTabData } from '../../../store/reducers/webTabs';

import Desktop from './Container/Desktop';
import Mobile from './Container/Mobile';
import WebContent from './Content/WebContent';
import { useNotifyChanges } from './Controller/useNotifyChanges';
import { useWebController } from './Controller/useWebController';
import {
  MatchDAppItemType,
  getWebviewWrapperRef,
  webHandler,
} from './explorerUtils';
import MoreView from './MoreMenu';

const showExplorerBar = webHandler !== 'browser';

const Explorer: FC = () => {
  useDesktopTopDragBarController({
    height: '0px',
  });
  const intl = useIntl();
  const toast = useToast();
  const {
    openMatchDApp,
    gotoSite,
    currentTab,
    tabs,
    incomingUrl,
    clearIncomingUrl,
    stopLoading,
    goBack,
    goForward,
  } = useWebController();
  const { loading, canGoBack, canGoForward } = currentTab;

  const isVerticalLayout = useIsVerticalLayout();

  const [visibleMore, setVisibleMore] = useState(false);

  useNotifyChanges();

  useFocusEffect(
    useCallback(() => {
      if (incomingUrl) {
        gotoSite({ url: incomingUrl, isNewWindow: true });
        clearIncomingUrl();
      }
    }, [clearIncomingUrl, gotoSite, incomingUrl]),
  );

  const onSearchSubmitEditing = (dapp: MatchDAppItemType | string) => {
    if (typeof dapp === 'string') {
      return gotoSite({ url: dapp });
    }
    openMatchDApp(dapp);
  };

  const onRefresh = useCallback(() => {
    const webviewRef = getWebviewWrapperRef({
      tabId: currentTab?.id,
    });
    // *** use key for refresh may cause multiple-tabbed webview bridge not working at production Desktop
    // refreshKey.current = Date.now().toString();
    // setRefreshId(currentTab.id);

    // *** use cross platform reload() method
    webviewRef?.reload();
  }, [currentTab?.id]);

  const explorerContent = useMemo(
    () =>
      tabs.map((tab) => (
        <Freeze key={`${tab.id}-Freeze`} freeze={!tab.isCurrent}>
          <WebContent {...tab} />
        </Freeze>
      )),
    [tabs],
  );

  const moreViewContent = useMemo(() => {
    const getCurrentUrl = () => currentTab.url ?? '';

    const onCopyUrlToClipboard = () => {
      copyToClipboard(getCurrentUrl());
      toast.show({ title: intl.formatMessage({ id: 'msg__copied' }) });
    };

    const onOpenBrowser = () => {
      openUrlExternal(getCurrentUrl());
    };

    const onGoHomePage = () => {
      stopLoading();
      backgroundApiProxy.dispatch(
        setWebTabData({ ...homeTab, id: currentTab?.id }),
      );
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
    return (
      <MoreView
        visible={visibleMore}
        onVisibleChange={setVisibleMore}
        onRefresh={onRefresh}
        onShare={onShare}
        onOpenBrowser={onOpenBrowser}
        onCopyUrlToClipboard={onCopyUrlToClipboard}
        onGoHomePage={onGoHomePage}
      />
    );
  }, [
    currentTab?.id,
    currentTab?.url,
    intl,
    onRefresh,
    stopLoading,
    toast,
    visibleMore,
  ]);

  const Container = isVerticalLayout ? Mobile : Desktop;
  return (
    <Box flex={1} bg="background-default">
      <Container
        explorerContent={explorerContent}
        showExplorerBar={showExplorerBar}
        onSearchSubmitEditing={onSearchSubmitEditing}
        moreView={moreViewContent}
        onMore={setVisibleMore}
        onRefresh={onRefresh}
        loading={loading}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        onGoBack={goBack}
        onNext={goForward}
        onStopLoading={stopLoading}
      />
    </Box>
  );
};

export default Explorer;
