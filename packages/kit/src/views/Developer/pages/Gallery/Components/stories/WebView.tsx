import { useCallback, useState } from 'react';

import { Button, Input, Page } from '@onekeyhq/components';
import { openUrlInApp } from '@onekeyhq/shared/src/utils/openUrlUtils';

export default function WebviewGallery() {
  const [url, setUrl] = useState('https://www.baidu.com');
  const openWebView = useCallback(() => {
    openUrlInApp(url);
  }, [url]);
  return (
    <Page>
      <Page.Body justifyContent="center" gap="$5" px="$10">
        <Input flex={1} value={url} onChangeText={setUrl} />
        <Button onPress={openWebView}>Go</Button>
      </Page.Body>
    </Page>
  );
}
