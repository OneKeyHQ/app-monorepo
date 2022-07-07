import React, { FC, useEffect, useMemo, useState } from 'react';

import { WebView } from 'react-native-webview';

import { Box, Center, Icon, Image } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

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

const SVGImage: FC<NFTProps> = ({ asset, width }) => {
  const object = useMemo(
    () => asset.animationUrl ?? asset.imageUrl,
    [asset.animationUrl, asset.imageUrl],
  );
  const fallbackElement = (
    <Center
      width={width}
      height="333px"
      bgColor="surface-default"
      borderRadius="20px"
    >
      <Icon name="QuestionMarkCircleOutline" size={166} />
    </Center>
  );
  return (
    <Center width={width} height={object?.height}>
      {object ? (
        <Image
          flex="1"
          alt={`image of ${
            typeof asset.name === 'string' ? asset.name : 'nft'
          }`}
          width={object?.width}
          height={object?.height}
          borderRadius="20px"
          src={object.secureUrl}
          fallbackElement={fallbackElement}
        />
      ) : (
        fallbackElement
      )}
    </Center>
  );
};

const Native: FC<NFTProps> = ({ asset, width }) => {
  const [svgContent, setSvgContent] = useState<string>();
  const object = useMemo(
    () => asset.animationUrl ?? asset.imageUrl,
    [asset.animationUrl, asset.imageUrl],
  );
  useEffect(() => {
    (async () => {
      if (object?.secureUrl) {
        try {
          const res = await fetch(object?.secureUrl);
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
  return <SVGImage {...rest} />;
};

export default NFTSVG;
