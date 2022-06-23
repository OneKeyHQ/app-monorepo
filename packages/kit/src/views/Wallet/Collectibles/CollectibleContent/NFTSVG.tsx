import React, { FC, useEffect, useMemo, useState } from 'react';

import { WebView } from 'react-native-webview';

import { Box } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import NFTImage from './NFTImage';
import { NFTProps } from './type';

const getHTML = (svgContent: string, size: number) =>
  `
<html data-key="key-${size}-${size}">
  <head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0, shrink-to-fit=no"> 
  <script>
    function overLoadFunctions() {
      window.alert = () => false;
      window.prompt = () => false;
      window.confirm  = () => false;
    }
    overLoadFunctions();
    window.onload = overLoadFunctions();
  </script>
  <style>
      html, body {
        margin: 0;
        padding: 0;
        height: 100%;
        width: 100%;
        overflow: hidden;
        background-color: transparent;
      }
      svg {
        position: fixed;
        top: 0;
        left: 0;
        height: 100%;
        width: 100%;
        overflow: hidden;
      }
    </style>
  </head>
  <body>
    ${svgContent}
  </body>
</html>`;

const Native: FC<NFTProps> = ({ asset, width }) => {
  const [svgContent, setSvgContent] = useState<string>();
  const uri = useMemo(
    () => asset.animationUrl ?? asset.imageUrl,
    [asset.animationUrl, asset.imageUrl],
  );
  useEffect(() => {
    (async () => {
      if (uri) {
        try {
          const res = await fetch(uri);
          const text = await res.text();
          if (text.toLowerCase().indexOf('<svg') !== -1) {
            setSvgContent(text);
          }
        } catch (err) {
          console.log(err);
        }
      }
    })();
  });

  return (
    <Box size={width}>
      <WebView
        originWhitelist={['*']}
        pointerEvents="none"
        scalesPageToFit
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        source={{ html: getHTML(svgContent ?? '', width as number) }}
        style={{
          backgroundColor: 'transparent',
        }}
      />
    </Box>
  );
};

const NFTSVG: FC<NFTProps> = ({ ...rest }) => {
  if (platformEnv.isNative) {
    return <Native {...rest} />;
  }
  return <NFTImage {...rest} />;
};

export default NFTSVG;
