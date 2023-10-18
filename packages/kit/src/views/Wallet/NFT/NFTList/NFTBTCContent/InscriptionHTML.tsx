import { useCallback } from 'react';

import { Box, Text } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import WebView from '../../../../../components/WebView';

import type { InscriptionContentProps } from '../type';
import type { IElectronWebView } from '@onekeyfe/cross-inpage-provider-types';
import type { IWebViewWrapperRef } from '@onekeyfe/onekey-cross-webview';

function InscriptionHTML({
  size,
  asset,
  showOrigin,
  ...props
}: InscriptionContentProps) {
  const innerSize = typeof size === 'number' ? `${size}px` : (size as string);

  const onWebViewRef = useCallback((ref: IWebViewWrapperRef | null) => {
    if (platformEnv.isDesktop && ref?.innerRef) {
      const webviewRef = ref.innerRef as IElectronWebView;
      webviewRef.addEventListener('dom-ready', () => {
        webviewRef.insertCSS('html,body{ overflow: hidden !important; }');
      });
    }
  }, []);
  const renderInscriptionHTML = useCallback(() => {
    // some html content will cause native webview crash
    if (showOrigin && !platformEnv.isNative) {
      return (
        <WebView
          containerProps={{
            width: innerSize,
            height: innerSize,
          }}
          isSpinnerLoading
          src={asset.contentUrl}
          onWebViewRef={onWebViewRef}
          scrolling="no"
        />
      );
    }
    return (
      <Text
        textAlign="center"
        width={innerSize}
        typography="Body1Mono"
        numberOfLines={0}
        color="text-subdued"
      >
        {asset.content_type.toUpperCase().split(';')[0]}
      </Text>
    );
  }, [
    asset.contentUrl,
    asset.content_type,
    innerSize,
    onWebViewRef,
    showOrigin,
  ]);

  return (
    <Box
      flexDirection="column"
      overflow="hidden"
      justifyContent="center"
      alignItems="center"
      size={innerSize}
      {...props}
    >
      {renderInscriptionHTML()}
    </Box>
  );
}

export default InscriptionHTML;
