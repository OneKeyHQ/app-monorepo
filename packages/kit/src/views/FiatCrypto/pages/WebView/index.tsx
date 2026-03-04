import { useRoute } from '@react-navigation/core';

import { Page } from '@onekeyhq/components';
import WebView from '@onekeyhq/kit/src/components/WebView';
import { useCrossDomainRedirect } from '@onekeyhq/kit/src/hooks/useCrossDomainRedirect';
import type {
  EModalFiatCryptoRoutes,
  IModalFiatCryptoParamList,
} from '@onekeyhq/shared/src/routes/fiatCrypto';

import type { RouteProp } from '@react-navigation/core';

export default function FiatCryptoWebView() {
  const route =
    useRoute<
      RouteProp<
        IModalFiatCryptoParamList,
        EModalFiatCryptoRoutes.FiatCryptoWebView
      >
    >();
  const { url, title } = route.params;
  const { onShouldStartLoadWithRequest, onOpenWindow } =
    useCrossDomainRedirect(url);

  return (
    <Page>
      <Page.Header title={title ?? ''} />
      <Page.Body>
        <WebView
          src={url}
          allowpopups
          onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
          onOpenWindow={onOpenWindow}
        />
      </Page.Body>
    </Page>
  );
}
