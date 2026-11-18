import { useEffect } from 'react';

import { setToastLinkHandler } from '@onekeyhq/components/src/actions/Toast';
import {
  openUrlExternal,
  openUrlInApp,
} from '@onekeyhq/shared/src/utils/openUrlUtils';
import { isAllowedWebViewUrl } from '@onekeyhq/shared/src/utils/webViewUrlSafety';
import { EQRCodeHandlerNames } from '@onekeyhq/shared/types/qrCode';

import useParseQRCodeLazy from '../../../views/ScanQrCode/hooks/useParseQRCodeLazy';

// The link comes from remote config, so apply the same policy the WebView
// overlay uses before hosting it inside the app.
function openInApp(link: string) {
  if (!isAllowedWebViewUrl(link)) {
    openUrlExternal(link);
    return;
  }
  openUrlInApp(link, undefined, { enableDappBridge: true });
}

/**
 * Opens links inside toast text the way `HyperlinkText` opens them: OneKey
 * deep links resolve inside the app, a plain web link goes to the system
 * browser (`<url>`) or the in-app browser (`<urlInApp>`).
 */
export function ToastLinkHandler() {
  const parseQRCode = useParseQRCodeLazy();
  useEffect(() => {
    setToastLinkHandler(({ kind, url }) => {
      void parseQRCode.parse(url, {
        handlers: [
          EQRCodeHandlerNames.marketDetail,
          EQRCodeHandlerNames.sendProtection,
          EQRCodeHandlerNames.rewardCenter,
          EQRCodeHandlerNames.updatePreview,
        ],
        qrWalletScene: false,
        autoExecuteParsedAction: true,
        defaultHandler: kind === 'urlInApp' ? openInApp : openUrlExternal,
      });
    });
    return () => setToastLinkHandler(undefined);
  }, [parseQRCode]);
  return null;
}
