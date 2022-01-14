import React, { useState } from 'react';

import { Box, IconButton, useLocale, useTheme } from '@onekeyhq/components';

import WebView from '../../components/WebView';

const Discover = () => {
  const { themeVariant } = useTheme();
  const { locale } = useLocale();
  const initialUrl = `https://discover.test.onekey.so/?theme=${themeVariant}&locale=${locale}`;
  const [url, setUrl] = useState(initialUrl);
  console.log('Discover url changed: ', url);
  return (
    <Box flex="1" bg="background-default">
      {url !== initialUrl && (
        <IconButton
          name="ArrowLeftSolid"
          position="absolute"
          left={4}
          bottom={4}
          zIndex={1}
          onPress={() => setUrl(initialUrl)}
        />
      )}
      <WebView src={url} onSrcChange={setUrl} />
    </Box>
  );
};

export default Discover;
