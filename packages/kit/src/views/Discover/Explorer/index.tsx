import { FC, useCallback, useMemo, useState } from 'react';

import { RouteProp, useRoute } from '@react-navigation/core';
import { useFocusEffect } from '@react-navigation/native';
import { Freeze } from 'react-freeze';
import { useIntl } from 'react-intl';
import { Platform, Share } from 'react-native';

import { Box, useIsVerticalLayout, useToast } from '@onekeyhq/components';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import { openUrlExternal } from '@onekeyhq/kit/src/utils/openUrl';

import { useNavigation } from '../../../hooks';
import { TabRoutes, TabRoutesParams } from '../../../routes/types';

import Desktop from './Container/Desktop';
import Mobile from './Container/Mobile';
import WebContent from './Content/WebContent';
import { useWebController } from './Controller/useWebController';
import { MatchDAppItemType, isValidDomain, webHandler } from './explorerUtils';
import MoreView from './MoreMenu';

const showExplorerBar = webHandler !== 'browser';

type DiscoverRouteProp = RouteProp<TabRoutesParams, TabRoutes.Discover>;
const Explorer: FC = () => {
  const intl = useIntl();
  const toast = useToast();
  const route = useRoute<DiscoverRouteProp>();
  const navigation = useNavigation();
  const { incomingUrl } = route.params || {};
  const { openMatchDApp, gotoSite, currentTab, tabs, gotoHome } =
    useWebController();

  const isVerticalLayout = useIsVerticalLayout();

  const [visibleMore, setVisibleMore] = useState(false);
  const [refreshKey, setRefreshKey] = useState<string | undefined>(undefined);

  useFocusEffect(
    useCallback(() => {
      // TODO: not work for tab
      if (incomingUrl) {
        gotoSite({ url: incomingUrl, isNewWindow: true });
      }
      return () => {
        navigation.setParams({ incomingUrl: undefined });
      };
    }, [gotoSite, incomingUrl, navigation]),
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
        onRefresh={() => setRefreshKey(String(Date.now()))}
        onShare={onShare}
        onOpenBrowser={onOpenBrowser}
        onCopyUrlToClipboard={onCopyUrlToClipboard}
        onGoHomePage={gotoHome}
      />
    );
  }, [currentTab?.url, gotoHome, intl, toast, visibleMore]);

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
