import { createContext } from 'react';

import { IWebViewWrapperRef } from '@onekeyfe/onekey-cross-webview';

type WebviewRefs = Record<string, IWebViewWrapperRef>;
export const webviewRefs: WebviewRefs = {};
export const WebviewRefsContext = createContext<WebviewRefs>(webviewRefs);
