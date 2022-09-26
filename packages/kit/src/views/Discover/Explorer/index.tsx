import { FC, useEffect, useMemo, useState } from 'react';

import { RouteProp, useRoute } from '@react-navigation/core';
import { Freeze } from 'react-freeze';
import { useIntl } from 'react-intl';
import { Platform, Share } from 'react-native';

import { Box, useIsVerticalLayout, useToast } from '@onekeyhq/components';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';

import { openUrlExternal } from '@onekeyhq/kit/src/utils/openUrl';

import { TabRoutes, TabRoutesParams } from '../../../routes/types';

import WebContent from './Content/WebContent';
import Mobile from './Container/Mobile';
import Desktop from './Container/Desktop';
import {
  MatchDAppItemType,
  SearchContentType,
  webHandler,
} from './explorerUtils';
import { useWebController } from './Controller/useWebController';
import MoreView from './MoreMenu';

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
  onMore?: () => any;
  moreView: React.ReactNode;
};

const showExplorerBar = webHandler !== 'browser';

type DiscoverRouteProp = RouteProp<TabRoutesParams, TabRoutes.Discover>;
const Explorer: FC = () => {
  const intl = useIntl();
  const toast = useToast();
  const route = useRoute<DiscoverRouteProp>();
  const { incomingUrl } = route.params || {};
  // const [searchContent, setSearchContent] = useState<SearchContentType>();
  const { openMatchDApp, gotoSite, currentTab, tabs, gotoHome } =
    useWebController();

  const isVerticalLayout = useIsVerticalLayout();

  const [visibleMore, setVisibleMore] = useState(false);
  const [refreshKey, setRefreshKey] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (incomingUrl) {
      gotoSite({ url: incomingUrl });
    }
  }, [incomingUrl]);

  const onSearchSubmitEditing = (dapp: MatchDAppItemType | string) => {
    if (typeof dapp === 'string') {
      return gotoSite({ url: dapp });
    }
    openMatchDApp(dapp);
  };

  const getCurrentUrl = () => currentTab?.url ?? '';

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
          <WebContent key={tab.isCurrent ? refreshKey : undefined} {...tab} />
        </Freeze>
      )),
    [tabs],
  );

  const moreViewContent = useMemo(
    () => (
      <MoreView
        visible={visibleMore}
        onVisibleChange={setVisibleMore}
        onRefresh={() => setRefreshKey(String(Date.now()))}
        onShare={onShare}
        onOpenBrowser={onOpenBrowser}
        onCopyUrlToClipboard={onCopyUrlToClipboard}
        onGoHomePage={gotoHome}
      />
    ),
    [visibleMore],
  );

  return (
    <Box flex={1} bg="background-default">
      {isVerticalLayout ? (
        <Mobile
          explorerContent={explorerContent}
          showExplorerBar={showExplorerBar}
          onSearchSubmitEditing={onSearchSubmitEditing}
          moreView={moreViewContent}
          onMore={setVisibleMore}
        />
      ) : (
        <Desktop
          explorerContent={explorerContent}
          showExplorerBar={showExplorerBar}
          onSearchSubmitEditing={onSearchSubmitEditing}
          moreView={moreViewContent}
          onMore={setVisibleMore}
        />
      )}
    </Box>
  );
};

export default Explorer;
