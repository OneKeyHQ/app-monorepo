import React, { FC, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { Platform, Share } from 'react-native';

import { Box, Button, Center, useIsSmallLayout } from '@onekeyhq/components';
import WebView from '@onekeyhq/kit/src/components/WebView';
import { useToast } from '@onekeyhq/kit/src/hooks';
import useOpenBrowser from '@onekeyhq/kit/src/hooks/useOpenBrowser';
import { copyToClipboard } from '@onekeyhq/kit/src/utils/ClipboardUtils';

import Desktop from './Content/Desktop';
import Mobile from './Content/Mobile';
import MoreMenuView from './MoreMenu';

export type ExplorerViewProps = {
  displayInitialPage?: boolean;
  searchContent?: string;
  onSearchContentChange?: (text: string) => void;
  onSearchSubmitEditing?: (text: string) => void;
  explorerContent: React.ReactNode;
  onGoBack?: () => void;
  onNext?: () => void;
  onRefresh?: () => void;
  onMore?: () => void;
  moreView: React.ReactNode;
};

const Explorer: FC = () => {
  console.log('Explorer');
  const intl = useIntl();
  const openBrowser = useOpenBrowser();
  const toast = useToast();

  const [visibleMore, setVisibleMore] = useState(false);

  const [displayInitialPage, setDisplayInitialPage] = useState(true);
  // 后退的栈
  const [urlStack, setUrlStack] = useState<string[]>([]);
  // 前进的栈
  const [urlPreStack, setUrlPreStack] = useState<string[]>([]);

  const [searchContent, setSearchContent] = useState<string | undefined>();
  const [currentUrl, setCurrentUrl] = useState<string | undefined>();

  const isSmallLayout = useIsSmallLayout();

  const pushStackUrl = (url: string) => {
    setUrlStack([...urlStack, url]);
  };

  const popStackUrl = () => {
    if (urlStack.length >= 1) {
      const url = urlStack.pop();
      const stack = [...urlStack];
      setUrlStack(stack);
      return url;
    }
    return null;
  };

  const pushPreStackUrl = (url: string) => {
    setUrlPreStack([...urlPreStack, url]);
  };

  const popPreStackUrl = () => {
    if (urlPreStack.length >= 1) {
      const url = urlPreStack.pop();
      const stack = [...urlPreStack];
      setUrlPreStack(stack);
      return url;
    }
    return null;
  };

  useEffect(() => {
    if (urlStack.length === 0) {
      setDisplayInitialPage(true);
      setSearchContent('');
    } else {
      setDisplayInitialPage(false);
      const url = urlStack[urlStack.length - 1];
      setCurrentUrl(url);
      setSearchContent(url);
    }
  }, [urlStack]);

  useEffect(() => {
    console.log('Explorer useEffect currentUrl:', currentUrl);
  }, [currentUrl]);

  const onSearchSubmitEditing = (text: string) => {
    console.log('onSearchSubmitEditing', text);

    try {
      let url = text;
      if (!url.startsWith('http') && url.indexOf('.') !== -1 && url) {
        url = `http://${url}`;
      }
      url = new URL(url).toString();

      if (url) pushStackUrl(url);
      console.log('onSearchSubmitEditing pushStackUrl', url);
    } catch (error) {
      pushStackUrl(`https://www.google.com/search?q=${text}`);
      console.log('not a url', error);
    }
  };

  const onGoBack = () => {
    const url = popStackUrl();
    if (url) pushPreStackUrl(url);

    console.log('onGoBack');
  };

  const onNext = () => {
    const url = popPreStackUrl();
    if (url) {
      pushStackUrl(url);
    }

    console.log('onNext');
  };

  const onRefresh = () => {
    try {
      const polyfillUrl = new URL(currentUrl ?? '');
      polyfillUrl.searchParams.set(
        'onekey-browser-refresh',
        Math.random().toString(),
      );

      setCurrentUrl(polyfillUrl.toString());
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
          <Center flex={1}>
            <Button
              onPress={() => {
                pushStackUrl('https://www.baidu.com');
              }}
            >
              link www.baidu.com
            </Button>
            <Button
              mt={4}
              onPress={() => {
                pushStackUrl('https://portfolio.test.onekey.so');
              }}
            >
              link portfolio.test.onekey.so
            </Button>
            <Button
              mt={4}
              onPress={() => {
                pushStackUrl('https://swap.onekey.so/#/swap');
              }}
            >
              link OneKeySwap
            </Button>

            <Button
              mt={4}
              onPress={() => {
                pushStackUrl('https://app.uniswap.org/#/swap');
              }}
            >
              link uniswap
            </Button>

            <Button
              mt={4}
              onPress={() => {
                pushStackUrl('https://discover.test.onekey.so');
              }}
            >
              link discover onekey
            </Button>

            <Button
              mt={4}
              onPress={() => {
                pushStackUrl('https://example.walletconnect.org/');
              }}
            >
              link walletconnect
            </Button>

            <Button
              mt={4}
              onPress={() => {
                pushStackUrl('https://metamask.github.io/test-dapp/');
              }}
            >
              link metamask test-dapp
            </Button>

            <Button
              mt={4}
              onPress={() => {
                pushStackUrl('https://4v495.csb.app/');
              }}
            >
              link csb
            </Button>
          </Center>
        ) : (
          <WebView src={currentUrl ?? ''} openUrlInExt />
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
            searchContent={searchContent}
            onSearchContentChange={setSearchContent}
            onSearchSubmitEditing={onSearchSubmitEditing}
            explorerContent={explorerContent}
            onGoBack={onGoBack}
            onNext={onNext}
            onRefresh={onRefresh}
            onMore={onMore}
            moreView={moreViewContent}
          />
        ) : (
          <Desktop
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
          />
        )}
      </Box>
    </>
  );
};

export default Explorer;
