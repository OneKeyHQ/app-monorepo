import { Button, SizableText, Toast, YStack } from '@onekeyhq/components';
import {
  openUrlExternal,
  openUrlInApp,
  openUrlInDiscovery,
} from '@onekeyhq/shared/src/utils/openUrlUtils';

import { Layout } from './utils/Layout';

const DiscoveryBrowserGallery = () => {
  const openInWebView = (url: string, title: string) => {
    openUrlInApp(url, title);
    Toast.success({ title: `Opening ${title} in WebView` });
  };

  const openInDiscoveryBrowser = (url: string, title: string) => {
    openUrlInDiscovery({ url, title });
    Toast.success({ title: `Opening ${title} in Discovery Browser` });
  };

  const openInExternalBrowser = (url: string) => {
    openUrlExternal(url);
    Toast.success({ title: 'Opening in external browser' });
  };

  return (
    <Layout
      componentName="Discovery Browser"
      getFilePath={() => __CURRENT_FILE_PATH__}
      elements={[
        {
          title: 'Open URL in App WebView',
          description: 'Opens URLs in an in-app WebView modal',
          element: (
            <YStack gap="$4" alignItems="center">
              <SizableText
                size="$bodyMd"
                color="$textSubdued"
                textAlign="center"
              >
                Uses: openUrlInApp(url, title)
              </SizableText>
              <Button
                icon="GlobusOutline"
                onPress={() => openInWebView('https://uniswap.org', 'Uniswap')}
              >
                Open Uniswap
              </Button>
              <Button
                icon="GlobusOutline"
                variant="primary"
                onPress={() => openInWebView('https://opensea.io', 'OpenSea')}
              >
                Open OpenSea
              </Button>
              <Button
                icon="GlobusOutline"
                variant="tertiary"
                onPress={() => openInWebView('https://app.aave.com', 'Aave')}
              >
                Open Aave
              </Button>
            </YStack>
          ),
        },
        {
          title: 'Open in Discovery Browser',
          description:
            'Opens URLs in Discovery browser tab (creates new browser tab)',
          element: (
            <YStack gap="$4" alignItems="center">
              <SizableText
                size="$bodyMd"
                color="$textSubdued"
                textAlign="center"
              >
                {`Uses: openUrlInDiscovery({ url, title })`}
              </SizableText>
              <Button
                icon="GlobusOutline"
                variant="primary"
                onPress={() =>
                  openInDiscoveryBrowser('https://curve.fi', 'Curve Finance')
                }
              >
                Open Curve in Discovery
              </Button>
              <Button
                icon="GlobusOutline"
                onPress={() =>
                  openInDiscoveryBrowser('https://1inch.io', '1inch')
                }
              >
                Open 1inch in Discovery
              </Button>
            </YStack>
          ),
        },
        {
          title: 'Open in External Browser',
          description: 'Opens URLs in the system default browser',
          element: (
            <YStack gap="$4" alignItems="center">
              <SizableText
                size="$bodyMd"
                color="$textSubdued"
                textAlign="center"
              >
                Uses: openUrlExternal(url)
              </SizableText>
              <Button
                icon="ArrowTopRightOutline"
                onPress={() =>
                  openInExternalBrowser('https://pancakeswap.finance')
                }
              >
                Open PancakeSwap Externally
              </Button>
            </YStack>
          ),
        },
      ]}
    />
  );
};

export default DiscoveryBrowserGallery;
