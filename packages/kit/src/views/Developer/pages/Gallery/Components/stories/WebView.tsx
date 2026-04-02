import { useCallback, useState } from 'react';

import { Button, Input, Page } from '@onekeyhq/components';
import { EWebEmbedRoutePath } from '@onekeyhq/shared/src/consts/webEmbedConsts';
import openUrlUtils from '@onekeyhq/shared/src/utils/openUrlUtils';

export default function WebviewGallery() {
  const [url, setUrl] = useState('https://www.baidu.com');
  const [hashRoutePath, setHashRoutePath] = useState<string>(
    EWebEmbedRoutePath.primePurchase,
  );
  const openWebView = useCallback(() => {
    openUrlUtils.openUrlInApp(url);
  }, [url]);
  const openWebViewEmbed = useCallback(() => {
    openUrlUtils.openUrlByWebviewPro({
      url: '',
      title: 'WebView',
      isWebEmbed: true,
      hashRoutePath: hashRoutePath as any,
      hashRouteQueryParams: {
        primeUserId: 'hello-world-1234567890',
        primeUserEmail: 'hello-world@1234567890.com',
      },
    });
  }, [hashRoutePath]);
  return (
    <Page>
      <Page.Body justifyContent="center" gap="$5" px="$10">
        <Input flex={1} value={url} onChangeText={setUrl} />
        <Button onPress={openWebView}>Go</Button>

        <Input flex={1} value={hashRoutePath} onChangeText={setHashRoutePath} />
        <Button onPress={openWebViewEmbed}>GoWebEmbed</Button>
      </Page.Body>
    </Page>
  );
}
