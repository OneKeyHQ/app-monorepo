import { FC, useCallback, useMemo, useState } from 'react';

import { useFocusEffect } from '@react-navigation/native';
import { Freeze } from 'react-freeze';
import { useIntl } from 'react-intl';
import { Platform, Share } from 'react-native';

import { Box, useIsVerticalLayout, useToast } from '@onekeyhq/components';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import { openUrlExternal } from '@onekeyhq/kit/src/utils/openUrl';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { homeTab, setWebTabData } from '../../../store/reducers/webTabs';

import Desktop from './Container/Desktop';
import Mobile from './Container/Mobile';
import WebContent from './Content/WebContent';
import { useWebController } from './Controller/useWebController';
import { MatchDAppItemType, isValidDomain, webHandler } from './explorerUtils';
import MoreView from './MoreMenu';

const showExplorerBar = webHandler !== 'browser';

const Explorer: FC = () => {
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
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const { loading, canGoBack, canGoForward } = currentTab!;

  const isVerticalLayout = useIsVerticalLayout();

  const [visibleMore, setVisibleMore] = useState(false);
  const [refreshKey, setRefreshKey] = useState<string | undefined>(undefined);

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
      if (dapp.startsWith('http')) {
        return gotoSite({ url: dapp });
      }
      if (isValidDomain(dapp)) {
        return gotoSite({ url: `https://${dapp}` });
      }
      return gotoSite({ url: `https://www.google.com/search?q=${dapp}` });
    }
    openMatchDApp(dapp);
  };

  const onRefresh = useCallback(() => setRefreshKey(String(Date.now())), []);

  const explorerContent = useMemo(
    () =>
      tabs.map((tab) => (
        <Freeze key={tab.id} freeze={!tab.isCurrent}>
          <WebContent key={tab.isCurrent ? refreshKey : undefined} {...tab} />
        </Freeze>
      )),
    [refreshKey, tabs],
  );

  const moreViewContent = useMemo(() => {
    const getCurrentUrl = () => currentTab?.url ?? '';

    const onCopyUrlToClipboard = () => {
      copyToClipboard(getCurrentUrl());
      toast.show({ title: intl.formatMessage({ id: 'msg__copied' }) });
    };

    const onOpenBrowser = () => {
      openUrlExternal(getCurrentUrl());
    };

    const onGoHomePage = () => {
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
  }, [currentTab?.id, currentTab?.url, intl, onRefresh, toast, visibleMore]);

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
