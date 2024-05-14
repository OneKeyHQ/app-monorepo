import { useCallback, useState } from 'react';

import { Button, Input, Page } from '@onekeyhq/components';
import { openUrl } from '@onekeyhq/kit/src/utils/openUrl';

export default function WebviewGallery() {
  const [url, setUrl] = useState('https://www.baidu.com');
  const openWebView = useCallback(() => {
    openUrl(url);
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
