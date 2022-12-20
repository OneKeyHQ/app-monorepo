import type { FC } from 'react';

import { WebView } from 'react-native-webview';

import { Box } from '@onekeyhq/components';

type Props = {
  size: number;
  url: string;
};

const getHTML = (svgContent: string) =>
  `
<div style="text-align: center; width: 100%;height:100%; display: table;border: clear solid 1px;">
  <span style="display: table-cell; vertical-align: middle; ">
      <img style="width: 100%;height:100%;" alt="" src=${svgContent} style="display: inline-block;" />
  </span>
</div>
`;

const NFTSVG: FC<Props> = ({ ...rest }) => {
  const { url, size } = rest;

  return (
    <Box size={`${size}px`}>
      <WebView
        containerStyle={{ borderRadius: 20 }}
        originWhitelist={['*']}
        pointerEvents="none"
        scalesPageToFit
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        source={{ html: getHTML(url) }}
        style={{
          backgroundColor: 'transparent',
        }}
      />
    </Box>
  );
};

export default NFTSVG;
