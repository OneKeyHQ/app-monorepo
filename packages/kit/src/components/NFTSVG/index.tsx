import React, { FC, useEffect, useState } from 'react';

import { WebView } from 'react-native-webview';

import { Box } from '@onekeyhq/components';

import { getSvgContent } from '../../utils/uriUtils';

type Props = {
  size: number;
  url: string;
};

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

const NFTSVG: FC<Props> = ({ ...rest }) => {
  const { url, size } = rest;
  const [svgContent, setSvgContent] = useState<string>();

  useEffect(() => {
    (async () => {
      if (url?.startsWith('http')) {
        try {
          const res = await fetch(url);
          const text = await res.text();
          if (text.toLowerCase().indexOf('<svg') !== -1) {
            setSvgContent(text);
          }
        } catch (err) {
          console.log(err);
        }
      } else {
        setSvgContent(getSvgContent(url));
      }
    })();
  }, [url]);

  return (
    <Box size={size}>
      <WebView
        originWhitelist={['*']}
        pointerEvents="none"
        scalesPageToFit
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        source={{ html: getHTML(svgContent ?? '', size) }}
        style={{
          backgroundColor: 'transparent',
        }}
      />
    </Box>
  );
};

export default NFTSVG;
