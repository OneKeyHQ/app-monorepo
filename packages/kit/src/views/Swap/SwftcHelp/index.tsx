import React from 'react';

import { NativeWebView } from '@onekeyfe/onekey-cross-webview';

import { Modal } from '@onekeyhq/components';

import { swftcCustomerSupportUrl } from '../config';

const SwapHelpCenter = () => {
  const injectedJavaScript = `(function(){
    var style = document.createElement('style');
    style.textContent = '#bw8_while_container { height: 100%!important; width: 100%; }'
    document.head.append(style);
  })()`;

  return (
    <Modal footer={null}>
      <NativeWebView
        src={swftcCustomerSupportUrl}
        injectedJavaScript={injectedJavaScript}
      />
    </Modal>
  );
};

export default SwapHelpCenter;
