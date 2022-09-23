import { RefObject, createContext, createRef } from 'react';

import { IWebViewWrapperRef } from '@onekeyfe/onekey-cross-webview';

export type WebviewRefs = Record<string, IWebViewWrapperRef>;
export const WebControllerContext = createContext<RefObject<WebviewRefs>>(
  createRef<WebviewRefs>(),
);
